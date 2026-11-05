import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PUSH_CHANNELS, pushRecipients, pushRole, type PushRole } from "@/lib/push-routing";
const loadFcm = () => import("@/lib/fcm.server");
const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
type Supa = SupabaseClient<Database>;
export function gatewayReady() {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["FIREBASE_MESSAGING_API_KEY"]);
}
export async function pushProviderReady() {
  const { readServiceAccount } = await loadFcm();
  return Boolean(
    process.env["SUPABASE_SERVICE_ROLE_KEY"] && (readServiceAccount() || gatewayReady()),
  );
}
/** Only claim after a delivery provider is configured. Publishing remains independent of push. */
export async function deliverUpdatePush(sb: Supa, updateId: string) {
  try {
    if (!(await pushProviderReady())) {
      console.error("Push delivery unavailable: notification provider is not configured");
      return;
    }
    const { data: senders, error: senderError } = await sb.rpc("get_update_senders", {
      _update_ids: [updateId],
    });
    if (senderError || !senders?.length) throw new Error("Couldn't identify update sender");
    const recipients = pushRecipients(senders[0]!.sender_is_admin);
    const { data, error } = await sb.rpc("claim_update_push", { _update_id: updateId });
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) return;
    const payload = {
      title: `${row.category === "holiday" ? "Holiday" : "Notice"}: ${row.title}`,
      body: row.body,
      updateId: row.id,
    };
    await sendToDevices(payload, recipients);
  } catch (err) {
    console.error("Push delivery failed:", err);
  }
}

/** No assumed foreign-key join: push_tokens.user_id has no profiles relationship. */
async function sendToDevices(
  payload: { title: string; body: string; updateId: string },
  recipients: PushRole[],
) {
  const { readServiceAccount, sendToDevice } = await loadFcm();
  const sa = readServiceAccount();
  const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
  // Page through tokens; do not silently miss devices after the database's default row limit.
  let failures = 0;
  for (let offset = 0; ; offset += 200) {
    const { data: tokens, error } = await sb
      .from("push_tokens")
      .select("id, token, user_id")
      .order("id")
      .range(offset, offset + 199);
    if (error) throw new Error(error.message);
    if (!tokens?.length) break;
    const ids = [...new Set(tokens.map((r) => r.user_id))];
    const [profiles, roles, teachers] = await Promise.all([
      sb.from("profiles").select("id, notify_updates").in("id", ids),
      sb.from("user_roles").select("user_id, role").in("user_id", ids),
      sb.from("teachers").select("profile_id, is_active, deleted_at").in("profile_id", ids),
    ]);
    if (profiles.error || roles.error || teachers.error)
      throw new Error("Couldn't resolve notification recipients");
    const optedIn = new Set(
      (profiles.data ?? []).filter((r) => r.notify_updates !== false).map((r) => r.id),
    );
    const activeTeachers = new Set(
      (teachers.data ?? []).filter((r) => r.is_active && !r.deleted_at).map((r) => r.profile_id),
    );
    const rolesByUser = new Map<string, string[]>();
    for (const row of roles.data ?? [])
      rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), row.role]);
    // Bound concurrency and retain failed tokens; a 400 response is not proof of expiry.
    for (let start = 0; start < tokens.length; start += 20) {
      const results = await Promise.allSettled(
        tokens.slice(start, start + 20).map(async (row) => {
          const role = pushRole(
            rolesByUser.get(row.user_id) ?? [],
            activeTeachers.has(row.user_id),
          );
          if (!optedIn.has(row.user_id) || !role || !recipients.includes(role)) return;
          if (sa) {
            await sendToDevice(sa, {
              ...payload,
              token: row.token,
              path: PUSH_CHANNELS[role].path,
            });
            return;
          }
          const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
              "X-Connection-Api-Key": process.env["FIREBASE_MESSAGING_API_KEY"]!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: row.token,
                notification: { title: payload.title, body: payload.body.slice(0, 180) },
                data: { updateId: payload.updateId, path: PUSH_CHANNELS[role].path },
                webpush: {
                  headers: { Urgency: "high" },
                  notification: { icon: "/icon-192.png", tag: payload.updateId },
                },
              },
            }),
          });
          if (!res.ok) throw new Error(`Notification rejected [${res.status}]`);
        }),
      );
      failures += results.filter((r) => r.status === "rejected").length;
    }
    if (tokens.length < 200) break;
  }
  if (failures) throw new Error(`${failures} device notifications failed`);
}
