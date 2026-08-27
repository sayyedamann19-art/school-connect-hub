import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classKey, validateRows, type ImportContext, type RawRow } from "@/lib/student-import";
import { IMPORT_COLUMNS } from "@/lib/student-import";

const PARENT_DOMAIN = "parents.schoolconnect.app";

function parentAlias(phone: string) {
  return `parent.${phone}@${PARENT_DOMAIN}`;
}

function currentAcademicYear() {
  const now = new Date();
  const startYear = now.getUTCMonth() + 1 >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

async function loadAuthorisation(supabase: {
  rpc: (name: "is_admin") => Promise<{ data: unknown }>;
  from: (table: "class_teachers") => {
    select: (columns: string) => Promise<{ data: { class: { name: string; division: string | null } | null }[] | null }>;
  };
}) {
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin) return { isAdmin: true, allowedClassKeys: null as string[] | null };

  const { data: assignments } = await supabase
    .from("class_teachers")
    .select("class:classes(name, division)");

  const allowedClassKeys = (assignments ?? [])
    .filter((row) => row.class)
    .map((row) => classKey(row.class!.name, row.class!.division));

  if (!allowedClassKeys.length) {
    throw new Error("You are not assigned to any class, so you can't import students");
  }
  return { isAdmin: false, allowedClassKeys };
}

/** Everything the browser needs to validate a file before anything is written. */
export const getImportContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { isAdmin, allowedClassKeys } = await loadAuthorisation(context.supabase as any);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: students, error } = await supabaseAdmin
      .from("students")
      .select("id, full_name, gr_number");
    if (error) throw new Error(error.message);

    const existingByGr: ImportContext["existingByGr"] = {};
    for (const student of students ?? []) {
      existingByGr[student.gr_number.toLowerCase()] = {
        id: student.id,
        fullName: student.full_name,
      };
    }

    return { isAdmin, allowedClassKeys, existingByGr, columns: IMPORT_COLUMNS };
  });

const rowSchema = z.object({
  rowNumber: z.number().int().positive(),
  values: z.record(z.string(), z.string().max(200)),
});

/** Applies a validated import. Rows with errors are skipped, never written. */
export const runStudentImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fileName: z.string().trim().max(200),
        rows: z.array(rowSchema).min(1).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { isAdmin, allowedClassKeys } = await loadAuthorisation(context.supabase as any);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingStudents } = await supabaseAdmin
      .from("students")
      .select("id, full_name, gr_number");
    const existingByGr: ImportContext["existingByGr"] = {};
    for (const student of existingStudents ?? []) {
      existingByGr[student.gr_number.toLowerCase()] = {
        id: student.id,
        fullName: student.full_name,
      };
    }

    // Server-side re-validation: the browser preview is never trusted.
    const validated = validateRows(data.rows as unknown as RawRow[], {
      existingByGr,
      allowedClassKeys,
    });

    const { data: classes } = await supabaseAdmin
      .from("classes")
      .select("id, name, division, academic_year");
    const classIdByKey = new Map<string, string>();
    for (const row of classes ?? []) classIdByKey.set(classKey(row.name, row.division), row.id);

    const { data: parentProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, phone")
      .not("phone", "is", null);
    const parentIdByPhone = new Map<string, string>();
    for (const profile of parentProfiles ?? []) {
      if (profile.phone) parentIdByPhone.set(profile.phone, profile.id);
    }

    const details: {
      rowNumber: number;
      grNumber: string;
      studentName: string;
      outcome: "created" | "updated" | "failed";
      message?: string;
    }[] = [];

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const entry of validated) {
      const { row } = entry;
      if (entry.action === "error") {
        failed += 1;
        details.push({
          rowNumber: row.rowNumber,
          grNumber: row.grNumber,
          studentName: row.fullName,
          outcome: "failed",
          message: entry.errors.join("; "),
        });
        continue;
      }

      try {
        // 1. Class (created on demand by admins only)
        const key = classKey(row.className, row.division);
        let classId = classIdByKey.get(key);
        if (!classId) {
          if (!isAdmin) throw new Error("This class doesn't exist yet — ask an administrator to create it");
          const { data: newClass, error: classError } = await supabaseAdmin
            .from("classes")
            .insert({
              name: row.className,
              division: row.division,
              academic_year: currentAcademicYear(),
            })
            .select("id")
            .single();
          if (classError) throw new Error(classError.message);
          classId = newClass.id;
          classIdByKey.set(key, classId);
        }

        // 2. Student (create or update by GR number)
        const existing = existingByGr[row.grNumber.toLowerCase()];
        const studentPatch = {
          full_name: row.fullName,
          gr_number: row.grNumber,
          roll_number: row.rollNumber,
          class_id: classId,
          height_cm: row.heightCm,
          weight_kg: row.weightKg,
        };

        let studentId: string;
        if (existing) {
          const { error } = await supabaseAdmin
            .from("students")
            .update(studentPatch)
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
          studentId = existing.id;
        } else {
          const { data: inserted, error } = await supabaseAdmin
            .from("students")
            .insert(studentPatch)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          studentId = inserted.id;
          existingByGr[row.grNumber.toLowerCase()] = { id: studentId, fullName: row.fullName };
        }

        // 3. Parent account, reused across siblings by phone number
        let parentId = parentIdByPhone.get(row.parentPhone);
        if (!parentId) {
          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: parentAlias(row.parentPhone),
            password: row.parentPhone,
            email_confirm: true,
            user_metadata: { full_name: row.parentName },
          });
          if (authError || !authUser.user) {
            throw new Error(authError?.message ?? "Couldn't create the parent account");
          }
          parentId = authUser.user.id;
          parentIdByPhone.set(row.parentPhone, parentId);
          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: parentId, role: "parent" }, { onConflict: "user_id,role" });
        }

        await supabaseAdmin
          .from("profiles")
          .upsert(
            {
              id: parentId,
              full_name: row.parentName,
              phone: row.parentPhone,
              login_alias: parentAlias(row.parentPhone),
            },
            { onConflict: "id" },
          );

        // 4. Parent -> student link (kept if it already exists)
        const { data: link } = await supabaseAdmin
          .from("parent_students")
          .select("id")
          .eq("student_id", studentId)
          .eq("parent_id", parentId)
          .maybeSingle();
        if (!link) {
          const { error: linkError } = await supabaseAdmin
            .from("parent_students")
            .insert({ student_id: studentId, parent_id: parentId });
          if (linkError) throw new Error(linkError.message);
        }

        if (existing) updated += 1;
        else created += 1;
        details.push({
          rowNumber: row.rowNumber,
          grNumber: row.grNumber,
          studentName: row.fullName,
          outcome: existing ? "updated" : "created",
        });
      } catch (error) {
        failed += 1;
        details.push({
          rowNumber: row.rowNumber,
          grNumber: row.grNumber,
          studentName: row.fullName,
          outcome: "failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    await supabaseAdmin.from("student_imports").insert({
      uploaded_by: userId,
      file_name: data.fileName,
      total_records: validated.length,
      created_count: created,
      updated_count: updated,
      failed_count: failed,
      status: failed === 0 ? "completed" : created + updated > 0 ? "partial" : "failed",
      details,
    });

    return { total: validated.length, created, updated, failed, details };
  });

/** Import history. RLS shows admins everything and teachers their own uploads. */
export const listImportHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("student_imports")
      .select(
        "id, file_name, total_records, created_count, updated_count, failed_count, status, details, created_at, uploaded_by",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const uploaderIds = [...new Set((data ?? []).map((row) => row.uploaded_by).filter(Boolean))] as string[];
    const nameById = new Map<string, string>();
    if (uploaderIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", uploaderIds);
      for (const profile of profiles ?? []) {
        nameById.set(profile.id, profile.full_name ?? "School staff");
      }
    }

    return (data ?? []).map((row) => ({
      ...row,
      uploadedByName: row.uploaded_by ? (nameById.get(row.uploaded_by) ?? "School staff") : "—",
    }));
  });
