import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Client = SupabaseClient<Database>;
const studentInput = z.object({ studentId: z.string().uuid() });
export type RecordSection = "attendance" | "feedback" | "character" | "results";
export type RecordItem = {
  id: string;
  date: string;
  title: string;
  detail: string | null;
  value: string;
};
export const RECORD_PAGE_SIZE = 50;

/** Additional staff check; every read still runs with the caller's own RLS session. */
async function staffStudent(sb: Client, userId: string, studentId: string) {
  const admin = await sb.rpc("is_admin");
  if (admin.error) throw new Error("Couldn't check student access");
  if (!admin.data) {
    const teacher = await sb
      .from("teachers")
      .select("id")
      .eq("profile_id", userId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (teacher.error || !teacher.data)
      throw new Error("Student records are available only to authorised staff");
    const allowed = await sb.rpc("teaches_student", { _student_id: studentId });
    if (allowed.error || !allowed.data) throw new Error("This student is not in a class you teach");
  }
  const result = await sb
    .from("students")
    .select(
      "id, full_name, gr_number, roll_number, date_of_birth, mother_name, address, contact_number, height_cm, weight_kg, photo_path, is_active, class:classes(name, division, academic_year)",
    )
    .eq("id", studentId)
    .maybeSingle();
  if (result.error) throw new Error("Couldn't load this student");
  if (!result.data) throw new Error("Student not found or access is no longer available");
  return result.data;
}

export const getStaffStudentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => studentInput.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const student = await staffStudent(sb, context.userId, data.studentId);
    const parents = await sb.rpc("get_student_parent_contacts", { _student_ids: [data.studentId] });
    if (parents.error) throw new Error("Couldn't load this student's parent contacts");
    let photoUrl: string | null = null;
    if (student.photo_path) {
      const photo = await sb.storage
        .from("student-photos")
        .createSignedUrl(student.photo_path, 600);
      photoUrl = photo.data?.signedUrl ?? null;
    }
    return { student, photoUrl, parents: parents.data ?? [] };
  });

export const getStaffStudentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    studentInput
      .extend({
        section: z.enum(["attendance", "feedback", "character", "results"]),
        page: z.number().int().min(0).max(10000).default(0),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      studentId: string;
      section: RecordSection;
      records: RecordItem[];
      hasMore: boolean;
    }> => {
      const sb = context.supabase;
      await staffStudent(sb, context.userId, data.studentId);
      const from = data.page * RECORD_PAGE_SIZE;
      const to = from + RECORD_PAGE_SIZE; // One extra row tells the UI whether another page exists.
      let records: RecordItem[];
      if (data.section === "attendance") {
        const res = await sb
          .from("attendance")
          .select("id, date, status, note")
          .eq("student_id", data.studentId)
          .order("date", { ascending: false })
          .order("id")
          .range(from, to);
        if (res.error) throw new Error("Couldn't load attendance");
        records = (res.data ?? []).map((r) => ({
          id: r.id,
          date: r.date,
          title: "Attendance",
          detail: r.note,
          value: r.status.replaceAll("_", " "),
        }));
      } else if (data.section === "feedback") {
        const res = await sb
          .rpc("get_student_notes", { _student_id: data.studentId })
          .order("note_date", { ascending: false })
          .order("id")
          .range(from, to);
        if (res.error) throw new Error("Couldn't load teacher feedback");
        records = (res.data ?? []).map((r) => ({
          id: r.id,
          date: r.note_date,
          title: r.teacher_name || "Teacher",
          detail: r.note,
          value: r.subject || "General feedback",
        }));
      } else if (data.section === "character") {
        const res = await sb
          .rpc("get_student_character_points", { _student_id: data.studentId })
          .order("awarded_on", { ascending: false })
          .order("id")
          .range(from, to);
        if (res.error) throw new Error("Couldn't load character history");
        records = (res.data ?? []).map((r) => ({
          id: r.id,
          date: r.awarded_on,
          title: r.teacher_name || "Teacher",
          detail: r.reason,
          value: `${r.points > 0 ? "+" : ""}${r.points} points`,
        }));
      } else {
        const res = await sb
          .from("academic_results")
          .select(
            "id, created_at, status, marks_obtained, maximum_marks, exam:academic_exams(name, academic_year, status), subject:subjects(name)",
          )
          .eq("student_id", data.studentId)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to);
        if (res.error) throw new Error("Couldn't load exam results");
        records = (res.data ?? []).map((r) => ({
          id: r.id,
          date: r.created_at.slice(0, 10),
          title: `${r.exam?.name ?? "Exam"} · ${r.exam?.academic_year ?? ""} · ${r.subject?.name ?? "Subject"}`,
          detail: r.exam?.status === "published" ? "Published" : "Draft — not visible to parents",
          value:
            r.status === "present"
              ? `${r.marks_obtained ?? "—"} / ${r.maximum_marks}`
              : r.status === "absent"
                ? "Absent"
                : "Not applicable",
        }));
      }
      return {
        studentId: data.studentId,
        section: data.section,
        records: records.slice(0, RECORD_PAGE_SIZE),
        hasMore: records.length > RECORD_PAGE_SIZE,
      };
    },
  );
