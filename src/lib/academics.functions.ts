import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ResultStatus = "present" | "absent" | "not_applicable";

export type AcademicExam = {
  id: string;
  academic_year: string;
  name: string;
  display_order: number;
  status: "draft" | "published";
  is_active: boolean;
  published_at: string | null;
};

export type Subject = { id: string; name: string; display_order: number; is_active: boolean };

export type ResultRow = {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_order: number;
  status: ResultStatus;
  marks_obtained: number | null;
  maximum_marks: number;
};

export type ExamSummary = {
  obtained: number;
  maximum: number;
  percent: number | null;
  absent: number;
  notApplicable: number;
  missing: number;
  complete: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

const EXAM_COLUMNS = "id, academic_year, name, display_order, status, is_active, published_at";

async function isAdmin(supabase: Sb) {
  const { data } = await supabase.rpc("is_admin");
  return Boolean(data);
}

async function assertAdmin(supabase: Sb) {
  if (!(await isAdmin(supabase))) throw new Error("Only administrators can do this");
}

async function assertManagesClass(supabase: Sb, classId: string) {
  if (await isAdmin(supabase)) return;
  const { data, error } = await supabase.rpc("teaches_class", { _class_id: classId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You are not assigned to this class");
}

/**
 * Totals from stored records only. Absent / not-applicable subjects are never
 * counted as zero; missing subjects make the result incomplete (no percentage).
 */
export function summarise(results: ResultRow[], expectedSubjects: number): ExamSummary {
  let obtained = 0;
  let maximum = 0;
  let absent = 0;
  let notApplicable = 0;
  for (const row of results) {
    if (row.status === "present" && row.marks_obtained !== null) {
      obtained += Number(row.marks_obtained);
      maximum += Number(row.maximum_marks);
    } else if (row.status === "absent") absent += 1;
    else notApplicable += 1;
  }
  const missing = Math.max(0, expectedSubjects - results.length);
  const complete = results.length > 0 && missing === 0;
  const percent = complete && maximum > 0 ? Math.round((obtained / maximum) * 1000) / 10 : null;
  return { obtained, maximum, percent, absent, notApplicable, missing, complete };
}

function mapResults(rows: Sb[]): ResultRow[] {
  return (rows ?? [])
    .map((row: Sb) => ({
      id: row.id,
      subject_id: row.subject_id,
      subject_name: row.subject?.name ?? "Subject",
      subject_order: row.subject?.display_order ?? 0,
      status: row.status,
      marks_obtained: row.marks_obtained === null ? null : Number(row.marks_obtained),
      maximum_marks: Number(row.maximum_marks),
    }))
    .sort((a: ResultRow, b: ResultRow) => a.subject_order - b.subject_order || a.subject_name.localeCompare(b.subject_name));
}

/* ----------------------------- Shared reads ----------------------------- */

export const listAcademicSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ exams: AcademicExam[]; subjects: Subject[] }> => {
    const [exams, subjects] = await Promise.all([
      context.supabase
        .from("academic_exams")
        .select(EXAM_COLUMNS)
        .order("academic_year", { ascending: false })
        .order("display_order", { ascending: true }),
      context.supabase
        .from("subjects")
        .select("id, name, display_order, is_active")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);
    if (exams.error) throw new Error(exams.error.message);
    if (subjects.error) throw new Error(subjects.error.message);
    return { exams: (exams.data ?? []) as AcademicExam[], subjects: (subjects.data ?? []) as Subject[] };
  });

/* ------------------------------ Parent side ----------------------------- */

export type StudentExamCard = { exam: AcademicExam; published: boolean; summary: ExamSummary | null };

/** A student's exams. RLS only returns results for published exams to parents. */
export const getStudentAcademics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ years: { year: string; exams: StudentExamCard[] }[] }> => {
    const { supabase } = context;
    const [examsRes, resultsRes, subjectsRes] = await Promise.all([
      supabase
        .from("academic_exams")
        .select(EXAM_COLUMNS)
        .eq("is_active", true)
        .order("academic_year", { ascending: false })
        .order("display_order", { ascending: true }),
      supabase
        .from("academic_results")
        .select("id, exam_id, subject_id, status, marks_obtained, maximum_marks, subject:subjects(name, display_order)")
        .eq("student_id", data.studentId),
      supabase.from("subjects").select("id").eq("is_active", true),
    ]);
    if (examsRes.error) throw new Error(examsRes.error.message);
    if (resultsRes.error) throw new Error(resultsRes.error.message);
    if (subjectsRes.error) throw new Error(subjectsRes.error.message);

    const byExam = new Map<string, Sb[]>();
    for (const row of resultsRes.data ?? []) {
      const list = byExam.get(row.exam_id) ?? [];
      list.push(row);
      byExam.set(row.exam_id, list);
    }
    const expected = (subjectsRes.data ?? []).length;

    const years = new Map<string, StudentExamCard[]>();
    for (const exam of (examsRes.data ?? []) as AcademicExam[]) {
      const published = exam.status === "published";
      const rows = mapResults(byExam.get(exam.id) ?? []);
      const card: StudentExamCard = {
        exam,
        published,
        summary: published && rows.length > 0 ? summarise(rows, expected) : null,
      };
      const list = years.get(exam.academic_year) ?? [];
      list.push(card);
      years.set(exam.academic_year, list);
    }
    return { years: Array.from(years, ([year, exams]) => ({ year, exams })) };
  });

export const getStudentExamResult = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studentId: z.string().uuid(), examId: z.string().uuid() }).parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      exam: AcademicExam | null;
      student: { full_name: string } | null;
      className: string | null;
      results: ResultRow[];
      summary: ExamSummary | null;
    }> => {
      const { supabase } = context;
      const [examRes, studentRes, resultsRes, subjectsRes] = await Promise.all([
        supabase.from("academic_exams").select(EXAM_COLUMNS).eq("id", data.examId).maybeSingle(),
        supabase.from("students").select("full_name, class:classes(name, division)").eq("id", data.studentId).maybeSingle(),
        supabase
          .from("academic_results")
          .select("id, subject_id, status, marks_obtained, maximum_marks, class:classes(name, division), subject:subjects(name, display_order)")
          .eq("student_id", data.studentId)
          .eq("exam_id", data.examId),
        supabase.from("subjects").select("id").eq("is_active", true),
      ]);
      if (examRes.error) throw new Error(examRes.error.message);
      if (studentRes.error) throw new Error(studentRes.error.message);
      if (resultsRes.error) throw new Error(resultsRes.error.message);
      // Student not readable through RLS → not linked / not authorised.
      if (!studentRes.data) return { exam: null, student: null, className: null, results: [], summary: null };

      const results = mapResults(resultsRes.data ?? []);
      const klass = (resultsRes.data?.[0] as Sb)?.class ?? (studentRes.data as Sb).class ?? null;
      const className = klass ? (klass.division ? `${klass.name}-${klass.division}` : klass.name) : null;
      return {
        exam: (examRes.data as AcademicExam) ?? null,
        student: { full_name: studentRes.data.full_name },
        className,
        results,
        summary: results.length > 0 ? summarise(results, (subjectsRes.data ?? []).length) : null,
      };
    },
  );

/* --------------------------- Teacher / admin side --------------------------- */

export type AcademicClass = { id: string; name: string; division: string | null; academic_year: string };

/** Admins see every class; teachers only their assigned classes. */
export const listAcademicClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ classes: AcademicClass[]; isAdmin: boolean }> => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase);
    if (admin) {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, division, academic_year")
        .order("name")
        .order("division");
      if (error) throw new Error(error.message);
      return { classes: (data ?? []) as AcademicClass[], isAdmin: true };
    }
    const { data, error } = await supabase
      .from("class_teachers")
      .select("class:classes(id, name, division, academic_year), teacher:teachers!inner(profile_id)")
      .eq("teacher.profile_id", userId);
    if (error) throw new Error(error.message);
    const seen = new Map<string, AcademicClass>();
    for (const row of (data ?? []) as Sb[]) if (row.class) seen.set(row.class.id, row.class);
    return { classes: Array.from(seen.values()), isAdmin: false };
  });

export type SheetStudent = { id: string; full_name: string; roll_number: string | null; gr_number: string };
export type SheetResult = {
  student_id: string;
  subject_id: string;
  status: ResultStatus;
  marks_obtained: number | null;
  maximum_marks: number;
};

const sheetInput = z.object({ examId: z.string().uuid(), classId: z.string().uuid() });

export const getExamSheet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sheetInput.parse(input))
  .handler(async ({ data, context }): Promise<{ students: SheetStudent[]; results: SheetResult[] }> => {
    const { supabase } = context;
    await assertManagesClass(supabase, data.classId);
    const { data: students, error } = await supabase
      .from("students")
      .select("id, full_name, roll_number, gr_number")
      .eq("class_id", data.classId)
      .eq("is_active", true)
      .order("roll_number", { ascending: true })
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (students ?? []).map((s) => s.id);
    if (ids.length === 0) return { students: [], results: [] };
    const { data: results, error: resultsError } = await supabase
      .from("academic_results")
      .select("student_id, subject_id, status, marks_obtained, maximum_marks")
      .eq("exam_id", data.examId)
      .in("student_id", ids);
    if (resultsError) throw new Error(resultsError.message);
    return {
      students: (students ?? []) as SheetStudent[],
      results: (results ?? []).map((r) => ({
        ...r,
        marks_obtained: r.marks_obtained === null ? null : Number(r.marks_obtained),
        maximum_marks: Number(r.maximum_marks),
      })) as SheetResult[],
    };
  });

const entrySchema = z
  .object({
    studentId: z.string().uuid(),
    subjectId: z.string().uuid(),
    status: z.enum(["present", "absent", "not_applicable"]),
    marks: z.number().min(0, "Marks cannot be negative").nullable(),
    maxMarks: z.number().positive("Maximum marks must be more than 0").max(1000),
    clear: z.boolean().optional(),
  })
  .superRefine((entry, ctx) => {
    if (entry.clear) return;
    if (entry.status === "present" && entry.marks === null)
      ctx.addIssue({ code: "custom", message: "Enter marks for present students" });
    if (entry.marks !== null && entry.marks > entry.maxMarks)
      ctx.addIssue({ code: "custom", message: "Marks cannot be more than maximum marks" });
  });

export const saveExamResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sheetInput.extend({ entries: z.array(entrySchema).min(1).max(5000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManagesClass(supabase, data.classId);
    const admin = await isAdmin(supabase);

    const { data: exam, error: examError } = await supabase
      .from("academic_exams")
      .select("status")
      .eq("id", data.examId)
      .maybeSingle();
    if (examError) throw new Error(examError.message);
    if (!exam) throw new Error("Exam not found");
    if (exam.status === "published" && !admin)
      throw new Error("These results are published. Ask an administrator to unpublish them before editing.");

    const { data: students, error } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", data.classId);
    if (error) throw new Error(error.message);
    const allowed = new Set((students ?? []).map((s) => s.id));
    const entries = data.entries.filter((e) => allowed.has(e.studentId));
    if (entries.length === 0) throw new Error("No students from this class were included");

    const { data: existing, error: existingError } = await supabase
      .from("academic_results")
      .select("id, student_id, subject_id, created_by")
      .eq("exam_id", data.examId)
      .in("student_id", Array.from(new Set(entries.map((e) => e.studentId))));
    if (existingError) throw new Error(existingError.message);
    const existingMap = new Map((existing ?? []).map((r) => [`${r.student_id}:${r.subject_id}`, r]));

    const toClear = entries
      .filter((e) => e.clear)
      .map((e) => existingMap.get(`${e.studentId}:${e.subjectId}`)?.id)
      .filter((id): id is string => Boolean(id));
    const rows = entries
      .filter((e) => !e.clear)
      .map((e) => ({
        student_id: e.studentId,
        exam_id: data.examId,
        subject_id: e.subjectId,
        class_id: data.classId,
        status: e.status,
        marks_obtained: e.status === "present" ? e.marks : null,
        maximum_marks: e.maxMarks,
        created_by: existingMap.get(`${e.studentId}:${e.subjectId}`)?.created_by ?? userId,
        updated_by: userId,
      }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("academic_results")
        .upsert(rows, { onConflict: "student_id,exam_id,subject_id" });
      if (upsertError) throw new Error(upsertError.message);
    }
    if (toClear.length > 0) {
      const { error: deleteError } = await supabase.from("academic_results").delete().in("id", toClear);
      if (deleteError) throw new Error(deleteError.message);
    }
    return { saved: rows.length, cleared: toClear.length };
  });

/* ------------------------------- Admin only ------------------------------- */

const examInput = z.object({
  academicYear: z.string().trim().regex(/^\d{4}-\d{2,4}$/, "Use a year like 2026-2027"),
  name: z.string().trim().min(2).max(80),
  displayOrder: z.number().int().min(0).max(999),
});

export const adminCreateExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => examInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { error } = await context.supabase.from("academic_exams").insert({
      academic_year: data.academicYear,
      name: data.name,
      display_order: data.displayOrder,
    });
    if (error) throw new Error(error.code === "23505" ? "This exam already exists for that year" : error.message);
    return { ok: true };
  });

export const adminUpdateExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        examId: z.string().uuid(),
        name: z.string().trim().min(2).max(80).optional(),
        displayOrder: z.number().int().min(0).max(999).optional(),
        isActive: z.boolean().optional(),
        status: z.enum(["draft", "published"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.displayOrder !== undefined) patch.display_order = data.displayOrder;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (data.status !== undefined) {
      patch.status = data.status;
      patch.published_at = data.status === "published" ? new Date().toISOString() : null;
    }
    const { error } = await context.supabase.from("academic_exams").update(patch).eq("id", data.examId);
    if (error) throw new Error(error.code === "23505" ? "This exam already exists for that year" : error.message);
    return { ok: true };
  });

export const adminSaveSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        subjectId: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(60).optional(),
        displayOrder: z.number().int().min(0).max(999).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    if (!data.subjectId) {
      if (!data.name) throw new Error("Enter a subject name");
      const { error } = await context.supabase
        .from("subjects")
        .insert({ name: data.name, display_order: data.displayOrder ?? 0 });
      if (error) throw new Error(error.code === "23505" ? "This subject already exists" : error.message);
      return { ok: true };
    }
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.displayOrder !== undefined) patch.display_order = data.displayOrder;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    const { error } = await context.supabase.from("subjects").update(patch).eq("id", data.subjectId);
    if (error) throw new Error(error.code === "23505" ? "This subject already exists" : error.message);
    return { ok: true };
  });
