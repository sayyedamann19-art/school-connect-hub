import { getRequest } from "@tanstack/react-start/server";
import type { AccountAction } from "@/lib/account-rules";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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


/** Privileged login work goes through the account service with the caller's own token. */
async function accountService<T>(action: AccountAction, payload: unknown): Promise<T> {
  const { runAccountAction, bearerFrom } = await import("@/lib/account-admin.server");
  return runAccountAction<T>(action, payload, { token: bearerFrom(getRequest()) });
}

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
    // The unique index treats "no division" as distinct, so check duplicates explicitly.
    const { data: same } = await context.supabase
      .from("classes")
      .select("name, division")
      .eq("academic_year", data.academicYear)
      .ilike("name", data.name.replace(/[\\%_]/g, (c) => `\\${c}`));
    if ((same ?? []).some((c) => (c.division ?? "").toLowerCase() === (data.division ?? "").toLowerCase())) {
      throw new Error("That class and division already exists for this academic year");
    }
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

/**
 * Delete a class division. Blocked while students, exam results or teacher notes
 * still reference it, so history is never lost silently. Teacher assignments and
 * the per-class subject template are removed with the class.
 */
export const adminDeleteClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ classId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Atomic, admin-checked in the database: blocks if any student is in the class,
    // keeps results/notes (detached), removes assignments and subject format.
    const { error } = await context.supabase.rpc("admin_delete_class", { _class_id: data.classId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove a teacher: drops class assignments and teacher access; history keeps attribution. */
export const adminDeleteTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ teacherId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_delete_teacher", { _teacher_id: data.teacherId });
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
      .is("deleted_at", null)
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
  .handler(async ({ data }) => {
    // Login creation runs in the account service, which re-verifies the admin role.
    return accountService<{ ok: true }>("create_teacher", data);
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
  .handler(async ({ data }) => {
    return accountService<{ ok: true; studentId: string }>("create_student", data);
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
  /** Other parent accounts also linked to this student. */
  otherParents: number;
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
    // Runs as the signed-in admin; database rules already grant admins these reads.
    const sb = context.supabase;
    const { data: roleRows, error: roleError } = await sb
      .from("user_roles")
      .select("user_id")
      .eq("role", "parent");
    if (roleError) throw new Error("We couldn't load parent accounts. Please try again.");

    const parentIds = [...new Set((roleRows ?? []).map((row) => row.user_id))];
    if (parentIds.length === 0) return [];

    const [{ data: profiles }, { data: links }, statusResult] = await Promise.all([
      sb.from("profiles").select("id, full_name, phone, login_alias").in("id", parentIds),
      sb
        .from("parent_students")
        .select(
          "id, parent_id, relationship, student:students(id, full_name, gr_number, roll_number, is_active, class:classes(name, division))",
        )
        .in("parent_id", parentIds),
      sb.rpc("admin_parent_account_status", { _ids: parentIds }),
    ]);

    const studentIds = [...new Set((links ?? []).map((l) => l.student?.id).filter(Boolean) as string[])];
    const { data: allLinks } = studentIds.length
      ? await sb.from("parent_students").select("parent_id, student_id").in("student_id", studentIds)
      : { data: [] as { parent_id: string; student_id: string }[] };
    const parentsOf = new Map<string, Set<string>>();
    for (const l of allLinks ?? []) {
      if (!parentsOf.has(l.student_id)) parentsOf.set(l.student_id, new Set());
      parentsOf.get(l.student_id)!.add(l.parent_id);
    }

    const bannedById = new Map<string, boolean>();
    for (const row of statusResult.data ?? []) bannedById.set(row.user_id, row.is_suspended);

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
          otherParents: [...(parentsOf.get(link.student!.id) ?? [])].filter((id) => id !== profile.id).length,
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

/** Creates a parent login and links one or more existing students. Admin only. */
export const adminCreateParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fullName: z.string().trim().min(2, "Enter the parent's name").max(120),
        phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number"),
        relationship: z.string().trim().max(30).optional(),
        studentIds: z.array(z.string().uuid()).min(1, "Link at least one student").max(10),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    return accountService<{ ok: true; parentId: string }>("create_parent", data);
  });

/**
 * Removes a parent account's access: unlinks all children and removes the parent role.
 * Student records, attendance, results and history are never touched. Students who would be
 * left with no parent are refused unless the admin explicitly confirms unlinking them.
 */
export const adminDeleteParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ parentId: z.string().uuid(), unlinkSoleChildren: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const sb = context.supabase;
    const { isManageableParent, soleParentStudents } = await import("@/lib/account-rules");
    const { data: roleRows } = await sb.from("user_roles").select("role").eq("user_id", data.parentId);
    const roles = (roleRows ?? []).map((r) => r.role as "admin" | "teacher" | "parent");
    if (!isManageableParent(roles)) throw new Error("Only parent accounts can be deleted here");

    const { data: links, error } = await sb
      .from("parent_students")
      .select("student_id, student:students(full_name)")
      .eq("parent_id", data.parentId);
    if (error) throw new Error("Couldn't load this parent's children");
    const ids = (links ?? []).map((l) => l.student_id);
    const { data: others } = ids.length
      ? await sb.from("parent_students").select("student_id").in("student_id", ids).neq("parent_id", data.parentId)
      : { data: [] as { student_id: string }[] };
    const sole = soleParentStudents(
      (links ?? []).map((l) => ({
        name: l.student?.full_name ?? "Student",
        otherParents: (others ?? []).filter((o) => o.student_id === l.student_id).length,
      })),
    );
    if (sole.length && !data.unlinkSoleChildren) {
      throw new Error(
        `${sole.map((s) => s.name).join(", ")} would have no parent login. Link another parent first, or confirm unlinking.`,
      );
    }

    const { error: unlinkErr } = await sb.from("parent_students").delete().eq("parent_id", data.parentId);
    if (unlinkErr) throw new Error("Couldn't unlink this parent's children");
    const { error: roleErr } = await sb
      .from("user_roles")
      .delete()
      .eq("user_id", data.parentId)
      .eq("role", "parent");
    if (roleErr) throw new Error("Children unlinked, but the parent role couldn't be removed");
    return { ok: true, unlinked: ids.length };
  });

/** Suspends or restores a parent login without deleting any records. */
export const adminSetParentActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ parentId: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    return accountService<{ ok: true }>("set_parent_active", data);
  });

/** Sets a new password for a parent login. Admin only (checked again in the account service). */
export const adminSetParentPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ parentId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data }) => {
    return accountService<{ ok: true }>("set_parent_password", data);
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
