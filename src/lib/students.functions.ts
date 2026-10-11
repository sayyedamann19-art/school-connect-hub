import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { isManageableParent, type Role } from "@/lib/account-rules";
import { parentAlias } from "@/lib/parent-domain";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length ? value : null))
    .nullable()
    .optional();

/** Classes visible to the signed-in staff member (RLS scopes teachers to their own). */
export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("classes")
      .select("id, name, division, academic_year")
      .order("name")
      .order("division");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Student management list. RLS limits teachers to students in their own classes. */
export const listManagedStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        search: z.string().trim().max(80).optional(),
        classId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("students")
      .select(
        "id, full_name, gr_number, roll_number, date_of_birth, height_cm, weight_kg, is_active, photo_path, class_id, class:classes(id, name, division, academic_year)",
      )
      .order("full_name")
      .limit(300);

    if (data.classId) query = query.eq("class_id", data.classId);
    if (data.search) {
      const term = `%${data.search}%`;
      query = query.or(`full_name.ilike.${term},gr_number.ilike.${term},roll_number.ilike.${term}`);
    }

    const { data: students, error } = await query;
    if (error) throw new Error(error.message);

    const studentIds = (students ?? []).map((student) => student.id);
    const parentByStudent = new Map<string, { fullName: string | null; phone: string | null }>();

    if (studentIds.length) {
      const { data: links } = await context.supabase.rpc("get_student_parent_contacts", {
        _student_ids: studentIds,
      });
      for (const link of links ?? []) {
        if (parentByStudent.has(link.student_id)) continue;
        parentByStudent.set(link.student_id, {
          fullName: link.full_name ?? null,
          phone: link.phone ?? null,
        });
      }
    }

    return (students ?? []).map((student) => ({
      ...student,
      parent: parentByStudent.get(student.id) ?? null,
    }));
  });

/** Whether the caller may edit a given student, plus admin flag for GR/parent fields. */
export const getEditPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: canEdit }, { data: isAdmin }] = await Promise.all([
      context.supabase.rpc("can_edit_student", { _student_id: data.studentId }),
      context.supabase.rpc("is_admin"),
    ]);
    return { canEdit: Boolean(canEdit), isAdmin: Boolean(isAdmin) };
  });

const updateSchema = z.object({
  studentId: z.string().uuid(),
  fullName: z.string().trim().min(1).max(120),
  grNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9/-]{3,32}$/)
    .optional(),
  rollNumber: optionalText(16),
  classId: z.string().uuid().nullable().optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  weightKg: z.number().positive().max(300).nullable().optional(),
  dateOfBirth: optionalText(10),
  isActive: z.boolean().optional(),
  photoPath: optionalText(300),
  parentName: optionalText(120),
  parentPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/)
    .optional(),
});

/** Manual edit of one student. Writes to the same record the parent dashboard reads. */
export const updateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: canEdit }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("can_edit_student", { _student_id: data.studentId }),
      supabase.rpc("is_admin"),
    ]);
    if (!canEdit) throw new Error("You don't have permission to edit this student");

    const patch: TablesUpdate<"students"> = {
      full_name: data.fullName,
      roll_number: data.rollNumber ?? null,
      height_cm: data.heightCm ?? null,
      weight_kg: data.weightKg ?? null,
      date_of_birth: data.dateOfBirth ?? null,
    };
    if (data.classId !== undefined) patch['class_id'] = data.classId;
    if (data.isActive !== undefined) patch['is_active'] = data.isActive;
    if (data.photoPath !== undefined) patch['photo_path'] = data.photoPath;
    if (data.grNumber && isAdmin) patch['gr_number'] = data.grNumber;

    const { error } = await supabase.from("students").update(patch).eq("id", data.studentId);
    if (error) throw new Error(error.message);

    // Parent contact details are ownership-adjacent, so admins only. Handled with the admin's
    // own session (database rules allow admins to edit profiles), so ordinary edits never need
    // the privileged account service. Only values that actually changed are written.
    if (isAdmin && (data.parentName !== undefined || data.parentPhone !== undefined)) {
      const { data: link } = await supabase
        .from("parent_students")
        .select("parent_id, parent:profiles(full_name, phone)")
        .eq("student_id", data.studentId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (link) {
        const patch: TablesUpdate<"profiles"> = {};
        const name = data.parentName ?? null;
        if (name && name !== (link.parent?.full_name ?? "")) patch.full_name = name;
        if (data.parentPhone && data.parentPhone !== (link.parent?.phone ?? "")) {
          patch.phone = data.parentPhone;
        }
        if (Object.keys(patch).length) {
          const { data: roleRows } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", link.parent_id);
          const roles = (roleRows ?? []).map((r) => r.role as Role);
          if (!isManageableParent(roles)) {
            throw new Error("Student saved, but the linked parent is a staff account and wasn't changed");
          }
          if (patch.phone) {
            const { data: clash } = await supabase
              .from("profiles")
              .select("id")
              .neq("id", link.parent_id)
              .or(`phone.eq.${patch.phone},login_alias.eq.${parentAlias(patch.phone)}`)
              .limit(1)
              .maybeSingle();
            if (clash) throw new Error("Student saved, but that parent phone number is already used by another account");
          }
          const { error: pErr } = await supabase.from("profiles").update(patch).eq("id", link.parent_id);
          if (pErr) throw new Error("Student saved, but the parent details couldn't be updated");
        }
      }
    }

    return { ok: true, updatedBy: userId };
  });

/**
 * Activates or deactivates a student. Admins may do this for anyone; teachers
 * only for students in their assigned classes (checked by the database).
 * Historical attendance, feedback and character records are left untouched.
 */
export const setStudentActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ studentId: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: canEdit } = await supabase.rpc("can_edit_student", {
      _student_id: data.studentId,
    });
    if (!canEdit) throw new Error("You can only change students in your assigned classes");

    const { error } = await supabase
      .from("students")
      .update({ is_active: data.isActive })
      .eq("id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
