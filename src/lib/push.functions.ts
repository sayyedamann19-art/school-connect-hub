import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

/** Saves this device's push token for the signed-in user. */
export const registerPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(10).max(4096) }).parse(input))
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
    return { ok: true };
  });

/** Removes a device token (sign-out or alerts turned off). */
export const unregisterPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(10).max(4096) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_tokens")
      .delete()
      .eq("token", data.token)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type PushPayload = { title: string; body: string; updateId: string };

/**
 * Sends a closed-app push alert for a freshly published update to every
 * signed-up device whose owner has update alerts turned on. No-ops when the
 * messaging connection isn't configured, so publishing never fails because
 * of push delivery.
 */
export async function sendUpdatePushNotifications(payload: PushPayload) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovableKey || !connectionKey) return;

  try {
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
        // 404 UNREGISTERED / 400 INVALID_ARGUMENT mean the token is dead — drop it.
        if (res.status === 404 || res.status === 400) staleIds.push(row.id);
      }),
    );

    if (staleIds.length > 0) {
      await supabaseAdmin.from("push_tokens").delete().in("id", staleIds);
    }
  } catch (err) {
    console.error("Push delivery failed:", err);
  }
}
