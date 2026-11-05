import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const tokenInput = z.object({ token: z.string().min(10).max(4096) });
type Supa = SupabaseClient<Database>;

export const registerPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tokenInput.parse(input))
  .handler(async ({ data, context }) => {
    const { runPushAction } = await import("@/lib/push-relay.server");
    await runPushAction(context.supabase, { action: "status" });
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

export const unregisterPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tokenInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_tokens")
      .delete()
      .eq("token", data.token)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Roles and preferences are checked at send time, including deleted/suspended staff. */
export async function sendUpdatePushNotifications(sb: Supa, updateId: string) {
  try {
    const { runPushAction } = await import("@/lib/push-relay.server");
    await runPushAction(sb, { action: "send", updateId });
  } catch (error) {
    // Notification failure must never undo publication.
    console.error("Push delivery unavailable:", error);
  }
}
