import { getRequest } from "@tanstack/react-start/server";
import type { ImportRowResult } from "@/lib/account-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classKey, validateRows, type ImportContext, type RawRow } from "@/lib/student-import";
import { IMPORT_COLUMNS } from "@/lib/student-import";


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

type Supa = Parameters<typeof loadAuthorisation>[0];

/**
 * The class chosen in Manage Class, after checking the caller may import into it
 * (admins: any class; teachers: only classes they are assigned to).
 */
async function loadTargetClass(supabase: unknown, classId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const auth = await loadAuthorisation(sb as Supa);
  const { data: row } = await sb
    .from("classes")
    .select("id, name, division, academic_year")
    .eq("id", classId)
    .maybeSingle();
  if (!row) throw new Error("That class doesn't exist or isn't one of yours");
  const target = row as { id: string; name: string; division: string | null; academic_year: string };
  if (!auth.isAdmin && !auth.allowedClassKeys!.includes(classKey(target.name, target.division))) {
    throw new Error("You can only manage your own classes");
  }
  return { auth, target };
}

/** Class header for the Manage Class page. */
export const getManageClass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ classId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { target } = await loadTargetClass(context.supabase, data.classId);
    const { count } = await context.supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("class_id", target.id);
    return { ...target, studentCount: count ?? 0 };
  });

/** Everything the browser needs to validate a file before anything is written. */
export const getImportContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { isAdmin, allowedClassKeys } = await loadAuthorisation(context.supabase as any);

    // Works without the privileged key: a database helper that answers only admins/teachers.
    const { data: students, error } = await context.supabase.rpc("import_student_lookup");
    if (error) throw new Error("We couldn't read the current student list. Please try again.");

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
        classId: z.string().uuid().optional(),
        rows: z.array(rowSchema).min(1).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { isAdmin, allowedClassKeys } = await loadAuthorisation(context.supabase as any);
    let targetClass: { name: string; division: string | null } | null = null;
    let academicYear = currentAcademicYear();
    if (data.classId) {
      const { target } = await loadTargetClass(context.supabase, data.classId);
      targetClass = { name: target.name, division: target.division };
      allowedClassKeys = [classKey(target.name, target.division)];
      academicYear = target.academic_year;
      isAdmin = false; // never create other classes from a Manage Class import
    }
    void isAdmin;

    // Duplicate-GR lookup through the same admin/teacher-only helper as the preview.
    const { data: existingStudents } = await context.supabase.rpc("import_student_lookup");
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
      targetClass,
    });

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

    const toWrite = validated.filter((entry) => entry.action !== "error");
    for (const entry of validated) {
      if (entry.action !== "error") continue;
      failed += 1;
      details.push({
        rowNumber: entry.row.rowNumber,
        grNumber: entry.row.grNumber,
        studentName: entry.row.fullName,
        outcome: "failed",
        message: entry.errors.join("; "),
      });
    }

    // Writes (students, parent logins, links) run in the account service, which re-checks
    // the caller's role and, for teachers, that every row belongs to one of their classes.
    const { runAccountAction, bearerFrom } = await import("@/lib/account-admin.server");
    const token = bearerFrom(getRequest());
    const byRowNumber = new Map(toWrite.map((entry) => [entry.row.rowNumber, entry.row]));
    for (let i = 0; i < toWrite.length; i += 50) {
      const batch = toWrite.slice(i, i + 50).map((entry) => entry.row);
      let results: ImportRowResult[];
      try {
        ({ results } = await runAccountAction<{ results: ImportRowResult[] }>(
          "import_rows",
          { academicYear, rows: batch, ...(data.classId ? { classId: data.classId } : {}) },
          { token },
        ));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Couldn't save these rows";
        results = batch.map((row) => ({ rowNumber: row.rowNumber, outcome: "failed", message }));
      }
      for (const result of results) {
        const row = byRowNumber.get(result.rowNumber);
        if (!row) continue;
        if (result.outcome === "created") created += 1;
        else if (result.outcome === "updated") updated += 1;
        else failed += 1;
        details.push({
          rowNumber: row.rowNumber,
          grNumber: row.grNumber,
          studentName: row.fullName,
          outcome: result.outcome,
          ...(result.message ? { message: result.message } : {}),
        });
      }
    }
    details.sort((x, y) => x.rowNumber - y.rowNumber);

    await context.supabase.from("student_imports").insert({
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
      // Admins can read every profile; teachers only see their own uploads anyway.
      const { data: profiles } = await context.supabase
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
