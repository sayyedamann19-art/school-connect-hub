import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parentAlias } from "@/lib/parent-domain";

/** Every function here is admin-only; the role is re-checked server-side. */
async function assertAdmin(supabase: { rpc: (name: "is_admin") => Promise<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_admin");
  if (!data) throw new Error("Only administrators can do this");
}

const classInput = z.object({
  name: z.string().trim().min(1).max(40),
  division: z
    .string()
    .trim()
    .max(10)
    .transform((value) => (value.length ? value : null))
    .nullable()
    .optional(),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Use the format 2026-2027"),
});

export type AdminClass = {
  id: string;
  name: string;
  division: string | null;
  academic_year: string;
  studentCount: number;
  teachers: { assignmentId: string; teacherId: string; name: string; subject: string | null; isClassTeacher: boolean }[];
};

/** Classes with their student counts and assigned teachers. */
export const adminListClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminClass[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { supabase } = context;

    const [{ data: classes, error }, { data: students }, { data: assignments }] = await Promise.all([
      supabase.from("classes").select("id, name, division, academic_year").order("name").order("division"),
      supabase.from("students").select("id, class_id").eq("is_active", true),
      supabase
        .from("class_teachers")
        .select("id, class_id, teacher_id, subject, is_class_teacher, teacher:teachers(profile_id)"),
    ]);
    if (error) throw new Error(error.message);

    const profileIds = [...new Set((assignments ?? []).map((row) => row.teacher?.profile_id).filter(Boolean))] as string[];
    const nameById = new Map<string, string>();
    if (profileIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
      for (const profile of profiles ?? []) nameById.set(profile.id, profile.full_name ?? "Teacher");
    }

    const countByClass = new Map<string, number>();
    for (const student of students ?? []) {
      if (!student.class_id) continue;
      countByClass.set(student.class_id, (countByClass.get(student.class_id) ?? 0) + 1);
    }

    return (classes ?? []).map((schoolClass) => ({
      ...schoolClass,
      studentCount: countByClass.get(schoolClass.id) ?? 0,
      teachers: (assignments ?? [])
        .filter((row) => row.class_id === schoolClass.id)
        .map((row) => ({
          assignmentId: row.id,
          teacherId: row.teacher_id,
          name: row.teacher?.profile_id ? (nameById.get(row.teacher.profile_id) ?? "Teacher") : "Teacher",
          subject: row.subject,
          isClassTeacher: row.is_class_teacher,
        })),
    }));
  });

export const adminCreateClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => classInput.parse(input))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { error } = await context.supabase.from("classes").insert({
      name: data.name,
      division: data.division ?? null,
      academic_year: data.academicYear,
    });
    if (error) {
      throw new Error(
        error.code === "23505" ? "That class, division and year already exists" : error.message,
      );
    }
    return { ok: true };
  });

export const adminUpdateClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => classInput.extend({ classId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { error } = await context.supabase
      .from("classes")
      .update({ name: data.name, division: data.division ?? null, academic_year: data.academicYear })
      .eq("id", data.classId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AdminTeacher = {
  id: string;
  profile_id: string;
  employee_code: string | null;
  is_active: boolean;
  name: string;
  phone: string | null;
  classes: { assignmentId: string; classId: string; label: string; subject: string | null; isClassTeacher: boolean }[];
};

/** Teachers with their profile details and class assignments. */
export const adminListTeachers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminTeacher[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { supabase } = context;

    const { data: teachers, error } = await supabase
      .from("teachers")
      .select("id, profile_id, employee_code, is_active")
      .order("employee_code");
    if (error) throw new Error(error.message);

    const profileIds = (teachers ?? []).map((row) => row.profile_id);
    const profileById = new Map<string, { full_name: string | null; phone: string | null }>();
    if (profileIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", profileIds);
      for (const profile of profiles ?? []) {
        profileById.set(profile.id, { full_name: profile.full_name, phone: profile.phone });
      }
    }

    const { data: assignments } = await supabase
      .from("class_teachers")
      .select("id, class_id, teacher_id, subject, is_class_teacher, class:classes(name, division)");

    return (teachers ?? []).map((teacher) => ({
      ...teacher,
      name: profileById.get(teacher.profile_id)?.full_name ?? "Teacher",
      phone: profileById.get(teacher.profile_id)?.phone ?? null,
      classes: (assignments ?? [])
        .filter((row) => row.teacher_id === teacher.id)
        .map((row) => ({
          assignmentId: row.id,
          classId: row.class_id,
          label: row.class
            ? `${row.class.name}${row.class.division ? `-${row.class.division}` : ""}`
            : "Class",
          subject: row.subject,
          isClassTeacher: row.is_class_teacher,
        })),
    }));
  });

/** Creates a staff login plus the matching teacher record and teacher role. */
export const adminCreateTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(160),
        password: z.string().min(8).max(72),
        employeeCode: z.string().trim().max(20).optional(),
        phone: z
          .string()
          .trim()
          .regex(/^[6-9]\d{9}$/)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (authError || !created.user) {
      throw new Error(authError?.message ?? "Couldn't create the teacher login");
    }
    const profileId = created.user.id;

    await supabaseAdmin.from("profiles").upsert(
      {
        id: profileId,
        full_name: data.fullName,
        ...(data.phone ? { phone: data.phone } : {}),
      },
      { onConflict: "id" },
    );
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: profileId, role: "teacher" }, { onConflict: "user_id,role" });

    const { error: teacherError } = await supabaseAdmin.from("teachers").insert({
      profile_id: profileId,
      ...(data.employeeCode ? { employee_code: data.employeeCode } : {}),
    });
    if (teacherError) throw new Error(teacherError.message);

    return { ok: true };
  });

export const adminSetTeacherActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ teacherId: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { error } = await context.supabase
      .from("teachers")
      .update({ is_active: data.isActive })
      .eq("id", data.teacherId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Assigns a teacher to a class. Attendance and feedback access follow from this. */
export const adminAssignTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        teacherId: z.string().uuid(),
        classId: z.string().uuid(),
        subject: z.string().trim().max(60).optional(),
        isClassTeacher: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { error } = await context.supabase.from("class_teachers").insert({
      teacher_id: data.teacherId,
      class_id: data.classId,
      ...(data.subject ? { subject: data.subject } : {}),
      is_class_teacher: data.isClassTeacher ?? false,
    });
    if (error) {
      throw new Error(
        error.code === "23505" ? "That teacher is already assigned to this class" : error.message,
      );
    }
    return { ok: true };
  });

export const adminUnassignTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ assignmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { error } = await context.supabase
      .from("class_teachers")
      .delete()
      .eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Adds one student by hand, with an optional parent account created or reused by phone. */
export const adminCreateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(120),
        grNumber: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9/-]{3,32}$/, "GR number can use letters, numbers, / and -"),
        classId: z.string().uuid().nullable().optional(),
        rollNumber: z.string().trim().max(16).optional(),
        dateOfBirth: z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        heightCm: z.number().positive().max(300).optional(),
        weightKg: z.number().positive().max(300).optional(),
        parentName: z.string().trim().max(120).optional(),
        parentPhone: z
          .string()
          .trim()
          .regex(/^[6-9]\d{9}$/)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: clash } = await supabaseAdmin
      .from("students")
      .select("id")
      .ilike("gr_number", data.grNumber)
      .maybeSingle();
    if (clash) throw new Error("A student with that GR number already exists");

    const { data: student, error } = await supabaseAdmin
      .from("students")
      .insert({
        full_name: data.fullName,
        gr_number: data.grNumber,
        class_id: data.classId ?? null,
        roll_number: data.rollNumber ?? null,
        date_of_birth: data.dateOfBirth ?? null,
        height_cm: data.heightCm ?? null,
        weight_kg: data.weightKg ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.parentPhone) {
      const { data: existingParent } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("phone", data.parentPhone)
        .maybeSingle();

      let parentId = existingParent?.id ?? null;
      if (!parentId) {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: parentAlias(data.parentPhone),
          password: data.parentPhone,
          email_confirm: true,
          user_metadata: { full_name: data.parentName ?? "Parent" },
        });
        if (authError || !authUser.user) {
          throw new Error(authError?.message ?? "Couldn't create the parent account");
        }
        parentId = authUser.user.id;
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: parentId, role: "parent" }, { onConflict: "user_id,role" });
      }

      await supabaseAdmin.from("profiles").upsert(
        {
          id: parentId,
          full_name: data.parentName ?? "Parent",
          phone: data.parentPhone,
          login_alias: parentAlias(data.parentPhone),
        },
        { onConflict: "id" },
      );

      await supabaseAdmin
        .from("parent_students")
        .insert({ parent_id: parentId, student_id: student.id });
    }

    return { ok: true, studentId: student.id };
  });

export const adminSetStudentActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ studentId: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { error } = await context.supabase
      .from("students")
      .update({ is_active: data.isActive })
      .eq("id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AdminParentStudent = {
  linkId: string;
  studentId: string;
  fullName: string;
  grNumber: string;
  rollNumber: string | null;
  isActive: boolean;
  classLabel: string | null;
  relationship: string;
};

export type AdminParent = {
  id: string;
  name: string;
  phone: string | null;
  loginAlias: string | null;
  isActive: boolean;
  students: AdminParentStudent[];
};

/** Parent accounts with their linked students. Admin only. */
export const adminListParents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ search: z.string().trim().max(80).optional() }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<AdminParent[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "parent");
    if (roleError) throw new Error(roleError.message);

    const parentIds = [...new Set((roleRows ?? []).map((row) => row.user_id))];
    if (parentIds.length === 0) return [];

    const [{ data: profiles }, { data: links }, authList] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, phone, login_alias").in("id", parentIds),
      supabaseAdmin
        .from("parent_students")
        .select(
          "id, parent_id, relationship, student:students(id, full_name, gr_number, roll_number, is_active, class:classes(name, division))",
        )
        .in("parent_id", parentIds),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const bannedById = new Map<string, boolean>();
    for (const user of authList.data?.users ?? []) {
      const banned = (user as { banned_until?: string | null }).banned_until;
      bannedById.set(user.id, Boolean(banned && new Date(banned) > new Date()));
    }

    const term = data.search?.toLowerCase() ?? "";

    const parents: AdminParent[] = (profiles ?? []).map((profile) => ({
      id: profile.id,
      name: profile.full_name ?? "Parent",
      phone: profile.phone,
      loginAlias: profile.login_alias,
      isActive: !(bannedById.get(profile.id) ?? false),
      students: (links ?? [])
        .filter((link) => link.parent_id === profile.id && link.student)
        .map((link) => ({
          linkId: link.id,
          studentId: link.student!.id,
          fullName: link.student!.full_name,
          grNumber: link.student!.gr_number,
          rollNumber: link.student!.roll_number,
          isActive: link.student!.is_active,
          classLabel: link.student!.class
            ? `${link.student!.class.name}${link.student!.class.division ? `-${link.student!.class.division}` : ""}`
            : null,
          relationship: link.relationship,
        })),
    }));

    const filtered = term
      ? parents.filter(
          (parent) =>
            parent.name.toLowerCase().includes(term) ||
            (parent.phone ?? "").toLowerCase().includes(term) ||
            parent.students.some(
              (student) =>
                student.fullName.toLowerCase().includes(term) ||
                student.grNumber.toLowerCase().includes(term),
            ),
        )
      : parents;

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  });

/** Links an existing student to an existing parent account. */
export const adminLinkParentStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        parentId: z.string().uuid(),
        studentId: z.string().uuid(),
        relationship: z.string().trim().max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { error } = await context.supabase.from("parent_students").insert({
      parent_id: data.parentId,
      student_id: data.studentId,
      ...(data.relationship ? { relationship: data.relationship } : {}),
    });
    if (error) {
      throw new Error(
        error.code === "23505" ? "That student is already linked to this parent" : error.message,
      );
    }
    return { ok: true };
  });

/** Removes a parent–student link. The student record itself is untouched. */
export const adminUnlinkParentStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ linkId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { error } = await context.supabase.from("parent_students").delete().eq("id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Suspends or restores a parent login without deleting any records. */
export const adminSetParentActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ parentId: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.parentId, {
      ban_duration: data.isActive ? "none" : "876000h",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AttendanceReportRow = {
  studentId: string;
  fullName: string;
  rollNumber: string | null;
  grNumber: string;
  present: number;
  absent: number;
  late: number;
  leftEarly: number;
  other: number;
  total: number;
  percent: number | null;
};

export type AttendanceReport = {
  rows: AttendanceReportRow[];
  totals: {
    present: number;
    absent: number;
    late: number;
    leftEarly: number;
    other: number;
    total: number;
    percent: number | null;
  };
};

/** Class attendance report for a date range, built from the existing records. */
export const adminAttendanceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        classId: z.string().uuid(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AttendanceReport> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { supabase } = context;

    const { data: students, error } = await supabase
      .from("students")
      .select("id, full_name, roll_number, gr_number")
      .eq("class_id", data.classId)
      .order("roll_number")
      .order("full_name");
    if (error) throw new Error(error.message);

    const studentIds = (students ?? []).map((student) => student.id);
    const records = studentIds.length
      ? ((
          await supabase
            .from("attendance")
            .select("student_id, status")
            .in("student_id", studentIds)
            .gte("date", data.from)
            .lte("date", data.to)
        ).data ?? [])
      : [];

    const rows: AttendanceReportRow[] = (students ?? []).map((student) => {
      const own = records.filter((record) => record.student_id === student.id);
      const count = (status: string) => own.filter((record) => record.status === status).length;
      const present = count("present");
      const total = own.length;
      return {
        studentId: student.id,
        fullName: student.full_name,
        rollNumber: student.roll_number,
        grNumber: student.gr_number,
        present,
        absent: count("absent"),
        late: count("late"),
        leftEarly: count("left_early"),
        other: count("other"),
        total,
        percent: total ? Math.round((present / total) * 100) : null,
      };
    });

    const sum = (key: keyof AttendanceReportRow) =>
      rows.reduce((acc, row) => acc + (typeof row[key] === "number" ? (row[key] as number) : 0), 0);
    const total = sum("total");
    const present = sum("present");

    return {
      rows,
      totals: {
        present,
        absent: sum("absent"),
        late: sum("late"),
        leftEarly: sum("leftEarly"),
        other: sum("other"),
        total,
        percent: total ? Math.round((present / total) * 100) : null,
      },
    };
  });
