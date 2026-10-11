import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendUpdatePushNotifications, syncOwnTopicMembership } from "@/lib/push.functions";

export type UpdateCategory = "notice" | "holiday";

/** Old rows may still carry school/attendance/feedback; they are shown as Notice. */
export function normalizeCategory(value: string | null | undefined): UpdateCategory {
  return value === "holiday" ? "holiday" : "notice";
}

type RawRow = Omit<SchoolUpdate, "sender_name" | "can_manage"> & { created_by?: string | null };

/** Adds the sender label (Admin or teacher name) and whether the caller may manage the row. */
async function decorate(
  supabase: unknown,
  rows: unknown[] | null,
  manage: { userId: string; isAdmin: boolean } | null,
): Promise<SchoolUpdate[]> {
  const list = (rows ?? []) as RawRow[];
  const senders = new Map<string, string>();
  if (list.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).rpc("get_update_senders", {
      _update_ids: list.map((r) => r.id),
    });
    for (const s of (data ?? []) as { update_id: string; sender_name: string }[]) {
      senders.set(s.update_id, s.sender_name);
    }
  }
  return list.map(({ created_by, ...row }) => ({
    ...row,
    category: normalizeCategory(row.category),
    sender_name: senders.get(row.id) ?? "School",
    can_manage: manage ? manage.isAdmin || created_by === manage.userId : false,
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
  sender_name: string;
  /** True when the current user may edit, publish or delete this update. */
  can_manage: boolean;
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
        "id, title, body, category, is_published, published_at, first_published_at, created_at, created_by",
      )
      .eq("is_published", true)
      .order("first_published_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return decorate(context.supabase, data, null);
  });

/** Every update, drafts included. Admin only (RLS also restricts drafts). */
export const adminListUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SchoolUpdate[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context.supabase as any);
    const { data, error } = await context.supabase
      .from("school_updates")
      .select("id, title, body, category, is_published, published_at, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return decorate(context.supabase, data, { userId: context.userId, isAdmin: true });
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
      await sendUpdatePushNotifications(context.supabase as never, row.id);
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
      .select("id, title, body, category")
      .single();
    if (error) throw new Error(error.message);
    if (data.isPublished && row) {
      await sendUpdatePushNotifications(context.supabase as never, row.id);
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
      .select("id, title, body, category, is_published, published_at, created_at, created_by")
      // Own updates (drafts included) plus every published update, e.g. from admins.
      .or(`created_by.eq.${context.userId},is_published.eq.true`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return decorate(context.supabase, data, { userId: context.userId, isAdmin: false });
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
      await sendUpdatePushNotifications(context.supabase as never, row.id);
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
      .select("id, title, body, category");
    if (error) throw new Error(error.message);
    requireChanged(rows);
    const row = rows?.[0];
    if (data.isPublished && row) {
      await sendUpdatePushNotifications(context.supabase as never, row.id);
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
    await syncOwnTopicMembership(context.supabase as never, context.userId, data.notifyUpdates);
    return { ok: true };
  });

/* ---------- Staff inbox (admin <-> teacher notifications) ---------- */

export type InboxUpdate = SchoolUpdate & { sender_is_admin: boolean };

export const listStaffInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InboxUpdate[]> => {
    const { staffInboxFilter } = await import("@/lib/unread");
    const sb = context.supabase;
    const { data: roleRows, error: roleError } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    const roles = (roleRows ?? []).map((r) => r.role);
    const role = roles.includes("admin") ? "admin" : roles.includes("teacher") ? "teacher" : null;
    if (!role) return [];
    let active = true;
    if (role === "teacher") {
      const { data: t } = await sb
        .from("teachers")
        .select("is_active, deleted_at")
        .eq("profile_id", context.userId)
        .maybeSingle();
      active = Boolean(t?.is_active && !t.deleted_at);
      if (!active) return [];
    }
    const { data, error } = await sb
      .from("school_updates")
      .select(
        "id, title, body, category, is_published, published_at, first_published_at, created_at, created_by",
      )
      .eq("is_published", true)
      .neq("created_by", context.userId)
      .order("first_published_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const senders = new Map<string, { name: string; isAdmin: boolean }>();
    if (rows.length) {
      const { data: s, error: sErr } = await sb.rpc("get_update_senders", {
        _update_ids: rows.map((r) => r.id),
      });
      if (sErr) throw new Error(sErr.message);
      for (const x of s ?? []) senders.set(x.update_id, { name: x.sender_name, isAdmin: x.sender_is_admin });
    }
    const isAdminMap = new Map(Array.from(senders, ([k, v]) => [k, v.isAdmin]));
    return staffInboxFilter(rows, isAdminMap, context.userId, role, active).map(
      ({ created_by: _c, ...row }) => ({
        ...row,
        category: normalizeCategory(row.category),
        sender_name: senders.get(row.id)?.name ?? "School",
        sender_is_admin: senders.get(row.id)?.isAdmin ?? false,
        can_manage: false,
      }),
    );
  });
