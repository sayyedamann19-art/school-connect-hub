import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SchoolUpdate = {
  id: string;
  title: string;
  body: string;
  category: "school" | "attendance" | "feedback" | "notice";
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};

const updateInput = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(2000),
  category: z.enum(["school", "attendance", "feedback", "notice"]),
  isPublished: z.boolean().optional(),
});

async function assertAdmin(supabase: { rpc: (name: "is_admin") => Promise<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_admin");
  if (!data) throw new Error("Only administrators can do this");
}

/** Published school updates, visible to every signed-in user (parents included). */
export const listPublishedUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SchoolUpdate[]> => {
    const { data, error } = await context.supabase
      .from("school_updates")
      .select("id, title, body, category, is_published, published_at, created_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as SchoolUpdate[];
  });

/** Every update, drafts included. Admin only (RLS also restricts drafts). */
export const adminListUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SchoolUpdate[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { data, error } = await context.supabase
      .from("school_updates")
      .select("id, title, body, category, is_published, published_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as SchoolUpdate[];
  });

export const adminCreateUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateInput.parse(input))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const publish = data.isPublished ?? false;
    const { error } = await context.supabase.from("school_updates").insert({
      title: data.title,
      body: data.body,
      category: data.category,
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateInput.extend({ updateId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { error } = await context.supabase
      .from("school_updates")
      .update({ title: data.title, body: data.body, category: data.category })
      .eq("id", data.updateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetUpdatePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ updateId: z.string().uuid(), isPublished: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { error } = await context.supabase
      .from("school_updates")
      .update({
        is_published: data.isPublished,
        published_at: data.isPublished ? new Date().toISOString() : null,
      })
      .eq("id", data.updateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ updateId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { error } = await context.supabase
      .from("school_updates")
      .delete()
      .eq("id", data.updateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
