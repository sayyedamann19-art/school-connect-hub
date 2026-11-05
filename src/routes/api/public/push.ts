import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
const actionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }),
  z.object({ action: z.literal("send"), updateId: z.string().uuid() }),
]);

export const Route = createFileRoute("/api/public/push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const reply = (body: object, status = 200) =>
          Response.json(body, { status, headers: { "cache-control": "no-store" } });
        if (!process.env["SUPABASE_SERVICE_ROLE_KEY"])
          return reply({ error: "Notification service unavailable" }, 503);
        const authorization = request.headers.get("authorization");
        if (!authorization?.startsWith("Bearer "))
          return reply({ error: "Please sign in again" }, 401);
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          {
            global: { headers: { authorization } },
            auth: { persistSession: false, autoRefreshToken: false },
          },
        );
        const { data: user, error } = await sb.auth.getUser(authorization.slice(7));
        if (error || !user.user) return reply({ error: "Please sign in again" }, 401);
        let action;
        try {
          action = actionInput.parse(await request.json());
        } catch {
          return reply({ error: "Invalid request" }, 400);
        }
        const { pushProviderReady, deliverUpdatePush } = await import("@/lib/push-delivery.server");
        if (!(await pushProviderReady()))
          return reply({ error: "School notifications are not connected yet" }, 503);
        if (action.action === "send") {
          // The claim runs as the caller, never as the privileged client. The existing
          // DB function permits only an admin or this update's author, once published.
          await deliverUpdatePush(sb, action.updateId);
        }
        return reply({ ok: true });
      },
    },
  },
});
