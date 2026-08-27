import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Children linked to the signed-in parent. RLS restricts rows to their own links. */
export const getMyChildren = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("parent_students")
      .select(
        "relationship, student:students(id, full_name, roll_number, date_of_birth, photo_path, is_active, class:classes(id, name, division, academic_year))",
      )
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((row) => row.student)
      .map((row) => ({ relationship: row.relationship, student: row.student! }));
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
          "id, full_name, roll_number, date_of_birth, photo_path, is_active, class:classes(id, name, division, academic_year)",
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

    return {
      student: studentResult.data,
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
