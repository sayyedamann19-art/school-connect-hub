/**
 * Privileged account service: creating logins, parent passwords/suspension, imports and
 * GR-number sign-in. These need the master backend key, which only the Lovable-hosted
 * server has. On Cloudflare (no key) calls are forwarded over HTTPS to the Lovable-hosted
 * copy of /api/public/account-admin together with the caller's own sign-in token, and the
 * service re-verifies that token and the caller's role from the database every time.
 */
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import {
  ATTEMPT_WINDOW_MINUTES,
  GENERIC_SIGN_IN_ERROR,
  canRun,
  exactIlike,
  isLockedOut,
  isManageableParent,
  teacherMayWriteRow,
  type AccountAction,
  type Role,
} from "@/lib/account-rules";
import { parentAlias } from "@/lib/parent-domain";

export class AccountError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const phone = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number");
const grNumber = z.string().trim().regex(/^[A-Za-z0-9/-]{1,32}$/, "Invalid GR number");

const schemas = {
  parent_sign_in: z.object({ grNumber: z.string().trim().min(1).max(32), password: z.string().min(1).max(72) }),
  create_teacher: z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(160),
    password: z.string().min(8).max(72),
    employeeCode: z.string().trim().max(20).optional(),
    phone: phone.optional(),
  }),
  create_student: z.object({
    fullName: z.string().trim().min(2).max(120),
    grNumber: z.string().trim().regex(/^[A-Za-z0-9/-]{3,32}$/, "GR number can use letters, numbers, / and -"),
    classId: z.string().uuid().nullable().optional(),
    rollNumber: z.string().trim().max(16).optional(),
    dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    heightCm: z.number().positive().max(300).optional(),
    weightKg: z.number().positive().max(300).optional(),
    parentName: z.string().trim().max(120).optional(),
    parentPhone: phone.optional(),
  }),
  import_rows: z.object({
    classId: z.string().uuid().optional(),
    academicYear: z.string().regex(/^\d{4}-\d{4}$/),
    rows: z
      .array(
        z.object({
          rowNumber: z.number().int().positive(),
          grNumber,
          fullName: z.string().trim().min(1).max(120),
          rollNumber: z.string().trim().max(16).nullable(),
          className: z.string().trim().min(1).max(40),
          division: z.string().trim().max(10).nullable(),
          heightCm: z.number().positive().max(300).nullable(),
          weightKg: z.number().positive().max(300).nullable(),
          parentName: z.string().trim().min(1).max(120),
          parentPhone: phone,
        }),
      )
      .min(1)
      .max(50),
  }),
  set_parent_active: z.object({ parentId: z.string().uuid(), isActive: z.boolean() }),
  set_parent_password: z.object({ parentId: z.string().uuid(), password: z.string().min(8).max(72) }),
  change_parent_contact: z.object({
    studentId: z.string().uuid(),
    parentName: z.string().trim().max(120).optional(),
    parentPhone: phone.optional(),
  }),
  create_parent: z.object({
    fullName: z.string().trim().min(2).max(120),
    phone,
    relationship: z.string().trim().max(30).optional(),
    studentIds: z.array(z.string().uuid()).min(1).max(10),
  }),
} satisfies Record<AccountAction, z.ZodTypeAny>;

export type AccountPayload<A extends AccountAction> = z.input<(typeof schemas)[A]>;

export type ImportRowResult = {
  rowNumber: number;
  outcome: "created" | "updated" | "failed";
  message?: string;
};

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Admin = Awaited<ReturnType<typeof admin>>;

async function rolesOf(sb: Admin, userId: string): Promise<Role[]> {
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new AccountError("Couldn't check permissions", 500);
  return (data ?? []).map((r) => r.role as Role);
}

async function verifyCaller(sb: Admin, token: string | null) {
  if (!token || token.split(".").length !== 3) throw new AccountError("Please sign in again", 401);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new AccountError("Please sign in again", 401);
  return { userId: data.user.id, roles: await rolesOf(sb, data.user.id) };
}

async function assertParentTarget(sb: Admin, parentId: string) {
  if (!isManageableParent(await rolesOf(sb, parentId))) {
    throw new AccountError("Only parent accounts can be changed here", 403);
  }
}

/** Reuse a parent by phone or create their login; never hijacks a staff account. */
async function ensureParent(sb: Admin, phoneNumber: string, name: string): Promise<string> {
  const alias = parentAlias(phoneNumber);
  const { data: existing } = await sb
    .from("profiles")
    .select("id")
    .or(`phone.eq.${phoneNumber},login_alias.eq.${alias}`)
    .limit(1)
    .maybeSingle();

  let parentId = existing?.id ?? null;
  if (parentId) {
    const roles = await rolesOf(sb, parentId);
    if (roles.length && !isManageableParent(roles)) {
      throw new AccountError("That phone number belongs to a staff account");
    }
  } else {
    const { data: created, error } = await sb.auth.admin.createUser({
      email: alias,
      password: phoneNumber,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error || !created.user) throw new AccountError("Couldn't create the parent login");
    parentId = created.user.id;
  }

  await sb.from("user_roles").upsert({ user_id: parentId, role: "parent" }, { onConflict: "user_id,role" });
  await sb
    .from("profiles")
    .upsert({ id: parentId, full_name: name, phone: phoneNumber, login_alias: alias }, { onConflict: "id" });
  return parentId;
}

async function linkParent(sb: Admin, parentId: string, studentId: string) {
  const { data: link } = await sb
    .from("parent_students")
    .select("id")
    .eq("student_id", studentId)
    .eq("parent_id", parentId)
    .maybeSingle();
  if (!link) {
    const { error } = await sb.from("parent_students").insert({ student_id: studentId, parent_id: parentId });
    if (error) throw new AccountError("Couldn't link the parent to the student");
  }
}

async function parentSignIn(sb: Admin, input: z.infer<typeof schemas.parent_sign_in>, ip: string | null) {
  const grKey = `gr:${input.grNumber.toLowerCase()}`;
  const ipKey = ip ? `ip:${ip}` : null;
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60_000).toISOString();
  const keys = ipKey ? [grKey, ipKey] : [grKey];

  const counts = await Promise.all(
    keys.map((key) =>
      sb
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("key", key)
        .gte("created_at", since)
        .then((r) => r.count ?? 0),
    ),
  );

  const fail = async (): Promise<never> => {
    await sb.from("login_attempts").insert(keys.map((key) => ({ key })));
    await new Promise((r) => setTimeout(r, 400));
    throw new AccountError(GENERIC_SIGN_IN_ERROR, 401);
  };

  if (counts.some(isLockedOut)) return fail();

  const { data: student } = await sb
    .from("students")
    .select("id")
    .ilike("gr_number", exactIlike(input.grNumber))
    .limit(1)
    .maybeSingle();

  let alias: string | null = null;
  if (student) {
    const { data: links } = await sb
      .from("parent_students")
      .select("parent:profiles(login_alias)")
      .eq("student_id", student.id)
      .order("created_at")
      .limit(10);
    // Staff accounts linked for testing have no parent login alias; use the parent login.
    alias = (links ?? []).map((l) => l.parent?.login_alias).find(Boolean) ?? null;
  }

  // Always attempt a password check so unknown GR numbers take the same path and time.
  const { data, error } = await publicClient().auth.signInWithPassword({
    email: alias ?? `nobody.${crypto.randomUUID()}@invalid.dawnbreakers.app`,
    password: input.password,
  });
  if (error || !alias || !data.session) return fail();

  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

async function importRows(
  sb: Admin,
  caller: { userId: string; roles: Role[] },
  input: z.infer<typeof schemas.import_rows>,
): Promise<ImportRowResult[]> {
  const isAdmin = caller.roles.includes("admin");
  const teacherClassIds = new Set<string>();
  if (!isAdmin) {
    const { data: teacher } = await sb.from("teachers").select("id").eq("profile_id", caller.userId).maybeSingle();
    if (teacher) {
      const { data: rows } = await sb.from("class_teachers").select("class_id").eq("teacher_id", teacher.id);
      for (const r of rows ?? []) teacherClassIds.add(r.class_id);
    }
    if (!teacherClassIds.size) throw new AccountError("You are not assigned to any class", 403);
  }

  const { data: classes } = await sb.from("classes").select("id, name, division");
  const key = (n: string, d: string | null) => `${n.trim().toLowerCase()}|${(d ?? "").trim().toLowerCase()}`;
  const classIdByKey = new Map((classes ?? []).map((c) => [key(c.name, c.division), c.id]));

  // Manage Class import: every row goes to the chosen class, which the caller must be allowed to use.
  let fixedClassId: string | null = null;
  if (input.classId) {
    const target = (classes ?? []).find((c) => c.id === input.classId);
    if (!target) throw new AccountError("That class no longer exists", 404);
    if (!isAdmin && !teacherClassIds.has(target.id)) {
      throw new AccountError("You can only import into your own classes", 403);
    }
    fixedClassId = target.id;
    for (const row of input.rows) {
      if (key(row.className, row.division) !== key(target.name, target.division)) {
        throw new AccountError("Every row must belong to the class you are importing into");
      }
    }
  }

  const results: ImportRowResult[] = [];
  for (const row of input.rows) {
    try {
      let classId = fixedClassId ?? classIdByKey.get(key(row.className, row.division)) ?? null;
      if (!classId) {
        if (!isAdmin) throw new AccountError("This class doesn't exist yet — ask an administrator to create it");
        const { data: c, error } = await sb
          .from("classes")
          .insert({ name: row.className, division: row.division, academic_year: input.academicYear })
          .select("id")
          .single();
        if (error) throw new AccountError("Couldn't create the class");
        classId = c.id;
        classIdByKey.set(key(row.className, row.division), classId);
      }

      const { data: existing } = await sb
        .from("students")
        .select("id, class_id")
        .ilike("gr_number", exactIlike(row.grNumber))
        .limit(1)
        .maybeSingle();

      if (
        !teacherMayWriteRow({
          isAdmin,
          targetClassId: classId,
          existingStudent: !!existing,
          existingStudentClassId: existing?.class_id,
          teacherClassIds,
        })
      ) {
        throw new AccountError(
          existing ? "This GR number belongs to a student outside your classes" : "You can only import into your own classes",
        );
      }

      const patch = {
        full_name: row.fullName,
        gr_number: row.grNumber,
        roll_number: row.rollNumber,
        class_id: classId,
        height_cm: row.heightCm,
        weight_kg: row.weightKg,
      };
      let studentId: string;
      if (existing) {
        const { error } = await sb.from("students").update(patch).eq("id", existing.id);
        if (error) throw new AccountError("Couldn't update the student");
        studentId = existing.id;
      } else {
        const { data: ins, error } = await sb.from("students").insert(patch).select("id").single();
        if (error) throw new AccountError("Couldn't create the student");
        studentId = ins.id;
      }

      const parentId = await ensureParent(sb, row.parentPhone, row.parentName);
      await linkParent(sb, parentId, studentId);
      results.push({ rowNumber: row.rowNumber, outcome: existing ? "updated" : "created" });
    } catch (e) {
      results.push({
        rowNumber: row.rowNumber,
        outcome: "failed",
        message: e instanceof AccountError ? e.message : "Couldn't save this row",
      });
    }
  }
  return results;
}

/** Runs an action locally. Only callable where the master key exists. */
export async function executeAccountAction(
  action: AccountAction,
  rawPayload: unknown,
  token: string | null,
  ip: string | null,
): Promise<unknown> {
  const sb = await admin();
  const parsed = schemas[action].safeParse(rawPayload);
  if (!parsed.success) {
    if (action === "parent_sign_in") throw new AccountError(GENERIC_SIGN_IN_ERROR, 401);
    throw new AccountError(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  if (action === "parent_sign_in") {
    return parentSignIn(sb, parsed.data as z.infer<typeof schemas.parent_sign_in>, ip);
  }

  const caller = await verifyCaller(sb, token);
  if (!canRun(action, caller.roles)) throw new AccountError("You don't have permission to do that", 403);

  switch (action) {
    case "create_teacher": {
      const d = parsed.data as z.infer<typeof schemas.create_teacher>;
      const { data: created, error } = await sb.auth.admin.createUser({
        email: d.email,
        password: d.password,
        email_confirm: true,
        user_metadata: { full_name: d.fullName },
      });
      if (error || !created.user) throw new AccountError("Couldn't create the teacher login (is the email already used?)");
      const id = created.user.id;
      await sb.from("profiles").upsert({ id, full_name: d.fullName, ...(d.phone ? { phone: d.phone } : {}) }, { onConflict: "id" });
      await sb.from("user_roles").upsert({ user_id: id, role: "teacher" }, { onConflict: "user_id,role" });
      const { error: tErr } = await sb
        .from("teachers")
        .insert({ profile_id: id, ...(d.employeeCode ? { employee_code: d.employeeCode } : {}) });
      if (tErr) throw new AccountError("Couldn't save the teacher record");
      return { ok: true };
    }
    case "create_student": {
      const d = parsed.data as z.infer<typeof schemas.create_student>;
      const { data: clash } = await sb
        .from("students")
        .select("id")
        .ilike("gr_number", exactIlike(d.grNumber))
        .limit(1)
        .maybeSingle();
      if (clash) throw new AccountError("A student with that GR number already exists");
      const { data: student, error } = await sb
        .from("students")
        .insert({
          full_name: d.fullName,
          gr_number: d.grNumber,
          class_id: d.classId ?? null,
          roll_number: d.rollNumber ?? null,
          date_of_birth: d.dateOfBirth ?? null,
          height_cm: d.heightCm ?? null,
          weight_kg: d.weightKg ?? null,
        })
        .select("id")
        .single();
      if (error) throw new AccountError("Couldn't create the student");
      if (d.parentPhone) {
        const parentId = await ensureParent(sb, d.parentPhone, d.parentName || "Parent");
        await linkParent(sb, parentId, student.id);
      }
      return { ok: true, studentId: student.id };
    }
    case "import_rows":
      return { results: await importRows(sb, caller, parsed.data as z.infer<typeof schemas.import_rows>) };
    case "set_parent_active": {
      const d = parsed.data as z.infer<typeof schemas.set_parent_active>;
      await assertParentTarget(sb, d.parentId);
      const { error } = await sb.auth.admin.updateUserById(d.parentId, {
        ban_duration: d.isActive ? "none" : "876000h",
      });
      if (error) throw new AccountError("Couldn't update the parent account");
      return { ok: true };
    }
    case "set_parent_password": {
      const d = parsed.data as z.infer<typeof schemas.set_parent_password>;
      await assertParentTarget(sb, d.parentId);
      const { error } = await sb.auth.admin.updateUserById(d.parentId, { password: d.password });
      if (error) throw new AccountError("Couldn't change the password");
      return { ok: true };
    }
    case "change_parent_contact": {
      const d = parsed.data as z.infer<typeof schemas.change_parent_contact>;
      const { data: link } = await sb
        .from("parent_students")
        .select("parent_id")
        .eq("student_id", d.studentId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (!link) return { ok: true, changed: false };
      await assertParentTarget(sb, link.parent_id);
      const patch: Database["public"]["Tables"]["profiles"]["Update"] = {};
      if (d.parentName !== undefined) patch.full_name = d.parentName;
      if (d.parentPhone !== undefined) {
        const alias = parentAlias(d.parentPhone);
        const { error } = await sb.auth.admin.updateUserById(link.parent_id, { email: alias, email_confirm: true });
        if (error) throw new AccountError("That phone number is already used by another login");
        patch.phone = d.parentPhone;
        patch.login_alias = alias;
      }
      if (Object.keys(patch).length) await sb.from("profiles").update(patch).eq("id", link.parent_id);
      return { ok: true, changed: true };
    }
    case "create_parent": {
      const d = parsed.data as z.infer<typeof schemas.create_parent>;
      const { data: clash } = await sb
        .from("profiles")
        .select("id")
        .or(`phone.eq.${d.phone},login_alias.eq.${parentAlias(d.phone)}`)
        .limit(1)
        .maybeSingle();
      if (clash) {
        throw new AccountError("A login with this phone number already exists — use Link a student on that parent instead", 409);
      }
      const ids = [...new Set(d.studentIds)];
      const { data: found } = await sb.from("students").select("id").in("id", ids);
      if ((found ?? []).length !== ids.length) throw new AccountError("One of the selected students no longer exists", 404);
      const parentId = await ensureParent(sb, d.phone, d.fullName);
      for (const studentId of ids) {
        const { data: link } = await sb
          .from("parent_students")
          .select("id")
          .eq("student_id", studentId)
          .eq("parent_id", parentId)
          .maybeSingle();
        if (!link) {
          const { error } = await sb.from("parent_students").insert({
            student_id: studentId,
            parent_id: parentId,
            ...(d.relationship ? { relationship: d.relationship } : {}),
          });
          if (error) throw new AccountError("Parent created, but a child couldn't be linked");
        }
      }
      return { ok: true, parentId };
    }
  }
  throw new AccountError("Unknown action");
}

// The Lovable-hosted copy is served on this custom domain. The *.lovable.app address redirects
// here, and browsers/fetch drop the sign-in header on a cross-site redirect, so call it directly.
const DEFAULT_SERVICE_URL = "https://accounts.dawnbreakerschool.app";

/**
 * Entry point for app server functions. Runs locally when this server holds the master key
 * (Lovable hosting); otherwise forwards to the Lovable-hosted account service (Cloudflare).
 */
export async function runAccountAction<T>(
  action: AccountAction,
  payload: unknown,
  opts: { token: string | null; ip?: string | null },
): Promise<T> {
  if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    return (await executeAccountAction(action, payload, opts.token, opts.ip ?? null)) as T;
  }
  const base = process.env["ACCOUNT_SERVICE_URL"] || DEFAULT_SERVICE_URL;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  if (opts.ip) headers["x-dbs-client-ip"] = opts.ip;
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/api/public/account-admin`, {
      method: "POST",
      redirect: "manual",
      headers,
      body: JSON.stringify({ action, payload }),
    });
  } catch {
    throw new AccountError("The account service is unreachable. Please try again.", 503);
  }
  if (res.status >= 300 && res.status < 400) {
    throw new AccountError("The account service address is out of date. Please contact the school office.", 503);
  }
  const body = (await res.json().catch(() => null)) as { error?: string; result?: T } | null;
  if (!res.ok) throw new AccountError(body?.error ?? "Something went wrong. Please try again.", res.status);
  return body?.result as T;
}

export function bearerFrom(request: Request | undefined): string | null {
  const h = request?.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export function clientIpFrom(request: Request | undefined): string | null {
  if (!request) return null;
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}
