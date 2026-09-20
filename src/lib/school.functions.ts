import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PHOTO_BUCKET = "student-photos";
const PHOTO_TTL_SECONDS = 60 * 60;


/** Signed URLs for private student photos, keyed by storage path. Read as the user. */
async function signPhotoPaths(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  paths: string[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(
    unique,
    PHOTO_TTL_SECONDS,
  );
  if (error) return {};

  const map: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry?.path && entry?.signedUrl) map[entry.path] = entry.signedUrl;
  }
  return map;
}

export type ParentChild = {
  id: string;
  full_name: string;
  gr_number: string;
  roll_number: string | null;
  date_of_birth: string | null;
  is_active: boolean;
  height_cm: number | null;
  weight_kg: number | null;
  photoUrl: string | null;
  relationship: string;
  class: { id: string; name: string; division: string | null; academic_year: string } | null;
  attendance: {
    percent: number | null;
    present: number;
    absent: number;
    late: number;
    leftEarly: number;
    other: number;
    total: number;
  };
  characterScore: number;
  recentNotes: { id: string; note: string; note_date: string; subject: string | null }[];
};

/** Children linked to the signed-in parent. RLS restricts rows to their own links. */
export const getMyChildren = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ parentName: string | null; children: ParentChild[] }> => {
    const { supabase, userId } = context;

    const [linkResult, profileResult] = await Promise.all([
      supabase
        .from("parent_students")
        .select(
          "relationship, created_at, student:students(id, full_name, gr_number, roll_number, date_of_birth, photo_path, is_active, height_cm, weight_kg, class:classes(id, name, division, academic_year))",
        )
        // Scope to this parent's own links: staff accounts can also read wider rows.
        .eq("parent_id", userId)
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);

    if (linkResult.error) throw new Error(linkResult.error.message);

    const links = (linkResult.data ?? []).filter((row) => row.student);
    const studentIds = links.map((row) => row.student!.id);

    if (studentIds.length === 0) {
      return { parentName: profileResult.data?.full_name ?? null, children: [] };
    }

    const [attendanceResult, pointsResult, notesResult, photoMap] = await Promise.all([
      supabase.from("attendance").select("student_id, status").in("student_id", studentIds),
      supabase.from("character_points").select("student_id, points").in("student_id", studentIds),
      supabase
        .from("teacher_notes")
        .select("id, student_id, note, note_date, subject")
        .in("student_id", studentIds)
        .order("note_date", { ascending: false })
        .limit(20),
      signPhotoPaths(
        supabase,
        links.map((row) => row.student!.photo_path).filter(Boolean) as string[],
      ),
    ]);

    const children: ParentChild[] = links.map((row) => {
      const student = row.student!;
      const records = (attendanceResult.data ?? []).filter((a) => a.student_id === student.id);
      const count = (status: string) => records.filter((a) => a.status === status).length;
      const present = count("present");
      const total = records.length;

      return {
        id: student.id,
        full_name: student.full_name,
        gr_number: student.gr_number,
        roll_number: student.roll_number,
        date_of_birth: student.date_of_birth,
        is_active: student.is_active,
        height_cm: student.height_cm,
        weight_kg: student.weight_kg,
        photoUrl: student.photo_path ? (photoMap[student.photo_path] ?? null) : null,
        relationship: row.relationship,
        class: student.class ?? null,
        attendance: {
          percent: total ? Math.round((present / total) * 100) : null,
          present,
          absent: count("absent"),
          late: count("late"),
          leftEarly: count("left_early"),
          other: count("other"),
          total,
        },
        characterScore: (pointsResult.data ?? [])
          .filter((p) => p.student_id === student.id)
          .reduce((sum, p) => sum + p.points, 0),
        recentNotes: (notesResult.data ?? [])
          .filter((n) => n.student_id === student.id)
          .slice(0, 2)
          .map((n) => ({
            id: n.id,
            note: n.note,
            note_date: n.note_date,
            subject: n.subject,
          })),
      };
    });

    return { parentName: profileResult.data?.full_name ?? null, children };
  });

/** Profile shell data for one student: identity plus light summary counts. */
export const getStudentOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [studentResult, attendanceResult, pointsResult, notesResult] = await Promise.all([
      supabase
        .from("students")
        .select(
          "id, full_name, gr_number, roll_number, date_of_birth, photo_path, is_active, height_cm, weight_kg, class:classes(id, name, division, academic_year)",
        )
        .eq("id", data.studentId)
        .maybeSingle(),
      supabase.from("attendance").select("status").eq("student_id", data.studentId),
      supabase.from("character_points").select("points").eq("student_id", data.studentId),
      supabase.from("teacher_notes").select("id").eq("student_id", data.studentId),
    ]);

    if (studentResult.error) throw new Error(studentResult.error.message);
    if (!studentResult.data) return null;

    const attendance = attendanceResult.data ?? [];
    const present = attendance.filter((row) => row.status === "present").length;
    const photoMap = await signPhotoPaths(
      supabase,
      studentResult.data.photo_path ? [studentResult.data.photo_path] : [],
    );

    return {
      student: studentResult.data,
      photoUrl: studentResult.data.photo_path
        ? (photoMap[studentResult.data.photo_path] ?? null)
        : null,
      summary: {
        attendanceRecords: attendance.length,
        presentRate: attendance.length ? Math.round((present / attendance.length) * 100) : null,
        characterScore: (pointsResult.data ?? []).reduce((total, row) => total + row.points, 0),
        noteCount: (notesResult.data ?? []).length,
      },
    };
  });

/** Classes and students visible to the signed-in teacher. */
export const getTeacherOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: assignments, error } = await supabase
      .from("class_teachers")
      .select("id, subject, is_class_teacher, class:classes(id, name, division, academic_year)");

    if (error) throw new Error(error.message);

    const classIds = (assignments ?? []).map((row) => row.class?.id).filter(Boolean) as string[];

    const students = classIds.length
      ? ((
          await supabase
            .from("students")
            .select("id, full_name, roll_number, class_id, photo_path")
            .in("class_id", classIds)
            .order("full_name")
        ).data ?? [])
      : [];

    return { assignments: assignments ?? [], students };
  });

/** School-wide counts for the admin area shell. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");

    const count = async (table: "students" | "classes" | "teachers" | "parent_students") => {
      const { count: rows, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return rows ?? 0;
    };

    return {
      students: await count("students"),
      classes: await count("classes"),
      teachers: await count("teachers"),
      parentLinks: await count("parent_students"),
    };
  });
