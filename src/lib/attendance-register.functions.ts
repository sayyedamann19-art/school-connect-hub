import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildClassAttendanceRegister,
  registerPeriod,
  validRegisterMonth,
  type RegisterAttendance,
  type RegisterStudent,
} from "@/lib/attendance-register";
import { schoolToday } from "@/lib/student-details";

export const adminClassAttendanceRegister = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        classId: z.string().uuid(),
        month: z
          .string()
          .refine(
            (value) => validRegisterMonth(value),
            "Choose a valid month that is not in the future",
          ),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const admin = await sb.rpc("is_admin");
    if (admin.error || !admin.data)
      throw new Error("Only administrators can print class attendance registers");
    const classResult = await sb
      .from("classes")
      .select("id, name, division, academic_year")
      .eq("id", data.classId)
      .maybeSingle();
    if (classResult.error) throw new Error("Could not load this class");
    if (!classResult.data) throw new Error("This class no longer exists");
    const today = schoolToday();
    const period = registerPeriod(data.month, today);
    const students: RegisterStudent[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const result = await sb
        .from("students")
        .select(
          "id, full_name, gr_number, roll_number, date_of_birth, mother_name, address, contact_number",
        )
        .eq("class_id", data.classId)
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (result.error)
        throw new Error("Could not load all students; the register was not generated");
      students.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < pageSize) break;
      if (students.length >= 5000)
        throw new Error("This class is too large to print as one register");
    }
    const records: RegisterAttendance[] = [];
    for (let batch = 0; batch < students.length; batch += 100) {
      const ids = students.slice(batch, batch + 100).map((s) => s.id);
      for (let offset = 0; ; offset += pageSize) {
        const result = await sb
          .from("attendance")
          .select("student_id, date, status")
          .in("student_id", ids)
          .gte("date", period.from)
          .lte("date", period.to)
          .order("date")
          .order("student_id")
          .range(offset, offset + pageSize - 1);
        if (result.error)
          throw new Error("Could not load all attendance; the register was not generated");
        records.push(...(result.data ?? []));
        if ((result.data?.length ?? 0) < pageSize) break;
      }
    }
    return buildClassAttendanceRegister(classResult.data, data.month, students, records, today);
  });
