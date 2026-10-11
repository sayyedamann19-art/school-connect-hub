import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const loadFcm = () => import("@/lib/fcm.server");

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const tokenInput = z.object({ token: z.string().min(10).max(4096) });

type Supa = {
  rpc: (...args: never[]) => unknown;
  from: (...args: never[]) => unknown;
};

/** Saves this device's push token and, for parents with alerts on, joins the updates topic. */
export const registerPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tokenInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_tokens").upsert(
      {
        user_id: context.userId,
        token: data.token,
        platform: "web",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw new Error(error.message);

    const { readServiceAccount, setTopicMembership } = await loadFcm();
    const sa = readServiceAccount();
    if (sa) {
      const [{ data: isParent }, { data: profile }] = await Promise.all([
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "parent" }),
        context.supabase.from("profiles").select("notify_updates").eq("id", context.userId).maybeSingle(),
      ]);
      if (isParent && (profile?.notify_updates ?? true)) {
        await setTopicMembership(sa, [data.token], true);
      }
    }
    return { ok: true };
  });

/** Removes a device token (sign-out or alerts turned off). */
export const unregisterPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tokenInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("push_tokens")
      .delete()
      .eq("token", data.token)
      .eq("user_id", context.userId)
      .select("token");
    if (error) throw new Error(error.message);
    const { readServiceAccount, setTopicMembership } = await loadFcm();
    const sa = readServiceAccount();
    if (sa && rows && rows.length > 0) {
      await setTopicMembership(sa, [data.token], false).catch((e) => console.error(e));
    }
    return { ok: true };
  });

/** Joins or leaves the updates topic for all of the signed-in user's own devices. */
export async function syncOwnTopicMembership(supabase: Supa, userId: string, subscribe: boolean) {
  const { readServiceAccount, setTopicMembership } = await loadFcm();
  const sa = readServiceAccount();
  if (!sa) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("push_tokens").select("token").eq("user_id", userId);
    const tokens = ((data ?? []) as { token: string }[]).map((r) => r.token);
    await setTopicMembership(sa, tokens, subscribe);
  } catch (err) {
    console.error("Topic sync failed:", err);
  }
}

/**
 * Sends a closed-app alert for a published update — at most once per update.
 * `claim_update_push` atomically marks the update as alerted and only succeeds
 * for an admin or the update's author, so re-publishing never re-notifies.
 * Never throws: publishing must not fail because of push delivery.
 */
export async function sendUpdatePushNotifications(supabase: Supa, updateId: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("claim_update_push", { _update_id: updateId });
    const row = (data as { id: string; title: string; body: string; category: string }[] | null)?.[0];
    if (error || !row) return;
    const title = `${row.category === "holiday" ? "Holiday" : "Notice"}: ${row.title}`;

    const { readServiceAccount, sendToTopic } = await loadFcm();
    const sa = readServiceAccount();
    if (sa) {
      await sendToTopic(sa, { title, body: row.body, updateId: row.id });
      return;
    }
    await sendViaGateway({ title, body: row.body, updateId: row.id });
  } catch (err) {
    console.error("Push delivery failed:", err);
  }
}

/** Fallback for Lovable hosting: per-device delivery through the connector gateway. */
async function sendViaGateway(payload: { title: string; body: string; updateId: string }) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovableKey || !connectionKey) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tokens, error } = await supabaseAdmin
    .from("push_tokens")
    .select("id, token, user_id, profiles!inner(notify_updates)")
    .eq("profiles.notify_updates", true)
    .limit(5000);
  if (error || !tokens || tokens.length === 0) return;

  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    "Content-Type": "application/json",
  };
  const staleIds: string[] = [];
  await Promise.allSettled(
    tokens.map(async (row) => {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: {
            token: row.token,
            notification: { title: payload.title, body: payload.body.slice(0, 180) },
            data: { updateId: payload.updateId, path: "/parent/notifications" },
          },
        }),
      });
      if (res.status === 404 || res.status === 400) staleIds.push(row.id);
    }),
  );
  if (staleIds.length > 0) await supabaseAdmin.from("push_tokens").delete().in("id", staleIds);
}
