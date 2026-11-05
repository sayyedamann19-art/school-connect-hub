import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { deliverUpdatePush, pushProviderReady } from "@/lib/push-delivery.server";
export type PushAction = { action: "status" } | { action: "send"; updateId: string };

/** Same host boundary as account actions; no backend master key on Cloudflare. */
export async function runPushAction(sb: SupabaseClient<Database>, action: PushAction) {
  if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!(await pushProviderReady())) throw new Error("School notifications are not connected yet");
    if (action.action === "send") await deliverUpdatePush(sb, action.updateId);
    return;
  }
  const authorization = getRequest().headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Please sign in again");
  const base = process.env["ACCOUNT_SERVICE_URL"] || "https://accounts.dawnbreakerschool.app";
  const url = new URL("/api/public/push", base);
  if (url.protocol !== "https:") throw new Error("Notification service must use HTTPS");
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization, "Content-Type": "application/json" },
    body: JSON.stringify(action),
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("School notification service is unavailable");
  const result = (await res.json()) as { ok?: boolean };
  if (!result.ok) throw new Error("School notification service is unavailable");
}
