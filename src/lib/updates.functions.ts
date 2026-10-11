import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendUpdatePushNotifications } from "@/lib/push.functions";

export type UpdateCategory = "notice" | "holiday";

/** Old rows may still carry school/attendance/feedback; they are shown as Notice. */
export function normalizeCategory(value: string | null | undefined): UpdateCategory {
  return value === "holiday" ? "holiday" : "notice";
}

function normalizeRows(rows: unknown[] | null): SchoolUpdate[] {
  return ((rows ?? []) as SchoolUpdate[]).map((row) => ({
    ...row,
    category: normalizeCategory(row.category),
  }));
}

export type SchoolUpdate = {
  id: string;
  title: string;
  body: string;
  category: UpdateCategory;
  is_published: boolean;
  first_published_at?: string | null;
  published_at: string | null;
  created_at: string;
};

const updateInput = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(2000),
  category: z.enum(["notice", "holiday"]),
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
      .select(
        "id, title, body, category, is_published, published_at, first_published_at, created_at",
      )
      .eq("is_published", true)
      .order("first_published_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return normalizeRows(data);
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
    return normalizeRows(data);
  });

export const adminCreateUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateInput.parse(input))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const publish = data.isPublished ?? false;
    const { data: row, error } = await context.supabase
      .from("school_updates")
      .insert({
        title: data.title,
        body: data.body,
        category: data.category,
        is_published: publish,
        published_at: publish ? new Date().toISOString() : null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (publish && row) {
      void sendUpdatePushNotifications({
        title: `${data.category === "holiday" ? "Holiday" : "Notice"}: ${data.title}`,
        body: data.body,
        updateId: row.id,
      });
    }
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
    const { data: row, error } = await context.supabase
      .from("school_updates")
      .update({
        is_published: data.isPublished,
        published_at: data.isPublished ? new Date().toISOString() : null,
      })
      .eq("id", data.updateId)
      .select("id, title, body, category, first_published_at")
      .single();
    if (error) throw new Error(error.message);
    // Only alert on the first publish — re-publishing must not re-notify.
    if (data.isPublished && row && !row.first_published_at) {
      void sendUpdatePushNotifications({
        title: `${normalizeCategory(row.category) === "holiday" ? "Holiday" : "Notice"}: ${row.title}`,
        body: row.body,
        updateId: row.id,
      });
    }
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

/* ---------- Teacher: create and manage only their own updates (RLS enforces ownership) ---------- */

async function assertTeacher(supabase: unknown, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc("has_role", { _user_id: userId, _role: "teacher" });
  if (!data) throw new Error("Only teachers can do this");
}

function requireChanged(rows: unknown[] | null) {
  if (!rows || rows.length === 0) throw new Error("You can only change updates you wrote");
}

export const teacherListUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SchoolUpdate[]> => {
    await assertTeacher(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("school_updates")
      .select("id, title, body, category, is_published, published_at, created_at")
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return normalizeRows(data);
  });

export const teacherCreateUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeacher(context.supabase, context.userId);
    const publish = data.isPublished ?? false;
    const { data: row, error } = await context.supabase
      .from("school_updates")
      .insert({
        title: data.title,
        body: data.body,
        category: data.category,
        is_published: publish,
        published_at: publish ? new Date().toISOString() : null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (publish && row) {
      void sendUpdatePushNotifications({
        title: `${data.category === "holiday" ? "Holiday" : "Notice"}: ${data.title}`,
        body: data.body,
        updateId: row.id,
      });
    }
    return { ok: true };
  });

export const teacherUpdateUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateInput.extend({ updateId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertTeacher(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("school_updates")
      .update({ title: data.title, body: data.body, category: data.category })
      .eq("id", data.updateId)
      .eq("created_by", context.userId)
      .select("id");
    if (error) throw new Error(error.message);
    requireChanged(rows);
    return { ok: true };
  });

export const teacherSetUpdatePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ updateId: z.string().uuid(), isPublished: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertTeacher(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("school_updates")
      .update({
        is_published: data.isPublished,
        published_at: data.isPublished ? new Date().toISOString() : null,
      })
      .eq("id", data.updateId)
      .eq("created_by", context.userId)
      .select("id, title, body, category, first_published_at");
    if (error) throw new Error(error.message);
    requireChanged(rows);
    const row = rows?.[0];
    if (data.isPublished && row && !row.first_published_at) {
      void sendUpdatePushNotifications({
        title: `${normalizeCategory(row.category) === "holiday" ? "Holiday" : "Notice"}: ${row.title}`,
        body: row.body,
        updateId: row.id,
      });
    }
    return { ok: true };
  });

export const teacherDeleteUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ updateId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertTeacher(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("school_updates")
      .delete()
      .eq("id", data.updateId)
      .eq("created_by", context.userId)
      .select("id");
    if (error) throw new Error(error.message);
    requireChanged(rows);
    return { ok: true };
  });

/* ---------- Parent: read status and notification preference ---------- */

export const listReadUpdateIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase
      .from("update_reads")
      .select("update_id")
      .eq("user_id", context.userId)
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.update_id);
  });

export const markUpdatesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ updateIds: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("update_reads").upsert(
      data.updateIds.map((id) => ({ user_id: context.userId, update_id: id })),
      { onConflict: "user_id,update_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getUpdateNotificationPref = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ notifyUpdates: boolean }> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("notify_updates")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { notifyUpdates: data?.notify_updates ?? true };
  });

export const setUpdateNotificationPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ notifyUpdates: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ notify_updates: data.notifyUpdates })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
