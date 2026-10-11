import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClassParent = {
  parentId: string;
  name: string;
  phone: string | null;
  children: {
    studentId: string;
    fullName: string;
    grNumber: string;
    rollNumber: string | null;
    classLabel: string | null;
    relationship: string;
  }[];
};

/**
 * Parents linked to students in the caller's assigned classes. The database helper
 * filters by teaches_student(), so teachers never receive other classes' families.
 */
export const listMyClassParents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClassParent[]> => {
    const { data, error } = await context.supabase.rpc("list_my_class_parents");
    if (error) throw new Error("We couldn't load parents. Please try again.");

    const byParent = new Map<string, ClassParent>();
    for (const row of data ?? []) {
      let parent = byParent.get(row.parent_id);
      if (!parent) {
        parent = {
          parentId: row.parent_id,
          name: row.full_name || "Parent",
          phone: row.phone,
          children: [],
        };
        byParent.set(row.parent_id, parent);
      }
      parent.children.push({
        studentId: row.student_id,
        fullName: row.student_name,
        grNumber: row.gr_number,
        rollNumber: row.roll_number,
        classLabel: row.class_label,
        relationship: row.relationship,
      });
    }
    return [...byParent.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
