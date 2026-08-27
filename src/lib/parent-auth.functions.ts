import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Resolves a student's GR number to the hidden internal login alias of the
 * parent account linked to that student. Returns nothing but the alias, and
 * the same shape for "not found" so the form can't be used to probe which GR
 * numbers exist.
 */
export const resolveParentLogin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ loginId: z.string().trim().min(1).max(32) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id")
      .ilike("gr_number", data.loginId)
      .maybeSingle();

    if (!student) return { email: null as string | null };

    const { data: links } = await supabaseAdmin
      .from("parent_students")
      .select("parent:profiles(login_alias)")
      .eq("student_id", student.id)
      .limit(1);

    const alias = links?.[0]?.parent?.login_alias ?? null;
    return { email: alias };
  });
