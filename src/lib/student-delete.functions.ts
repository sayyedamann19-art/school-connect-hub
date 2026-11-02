import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UnlinkedParent = { id: string; name: string };

/** Delete exactly one student using the admin's session and existing database cascades. */
export const adminDeleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ parents: UnlinkedParent[]; warning?: string }> => {
    const sb = context.supabase;
    const permission = await sb.rpc("is_admin");
    if (permission.error || !permission.data) throw new Error("Only administrators can delete students");

    const links = await sb.from("parent_students").select("parent_id").eq("student_id", data.studentId);
    if (links.error) throw new Error("Couldn't check the linked parents. Nothing was deleted.");
    const parentIds = [...new Set((links.data ?? []).map((row) => row.parent_id))];
    const removed = await sb.from("students").delete().eq("id", data.studentId).select("id, photo_path").maybeSingle();
    if (removed.error) throw new Error("Couldn't delete the student. Please try again.");
    if (!removed.data) throw new Error("This student no longer exists. Refresh the list.");

    // Failures after the successful deletion must never look like a failed student deletion.
    const warnings: string[] = [];
    if (removed.data.photo_path) {
      try {
        const photo = await sb.storage.from("student-photos").remove([removed.data.photo_path]);
        if (photo.error) warnings.push("The saved photo could not be removed.");
      } catch { warnings.push("The saved photo could not be removed."); }
    }
    let parents: UnlinkedParent[] = [];
    if (parentIds.length) {
      try {
        const [remaining, profiles, roles] = await Promise.all([
          sb.from("parent_students").select("parent_id").in("parent_id", parentIds),
          sb.from("profiles").select("id, full_name").in("id", parentIds),
          sb.from("user_roles").select("user_id, role").in("user_id", parentIds),
        ]);
        if (remaining.error || profiles.error || roles.error) throw new Error("Parent check failed");
        parents = (profiles.data ?? []).filter((p) => {
          const ownRoles = (roles.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
          return !remaining.data?.some((link) => link.parent_id === p.id)
            && ownRoles.includes("parent") && !ownRoles.includes("admin") && !ownRoles.includes("teacher");
        }).map((p) => ({ id: p.id, name: p.full_name ?? "Parent" }));
      } catch { warnings.push("Check the Parents page for accounts with no children linked."); }
    }
    return { parents, ...(warnings.length ? { warning: warnings.join(" ") } : {}) };
  });
