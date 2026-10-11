import { createFileRoute } from "@tanstack/react-router";

import { ACCOUNT_ACTIONS, type AccountAction } from "@/lib/account-rules";

// Privileged account service. Served from the Lovable-hosted app (which holds the master
// backend key) and called by the Cloudflare app's server functions. Every action except GR
// sign-in verifies the caller's sign-in token and database role inside executeAccountAction.
export const Route = createFileRoute("/api/public/account-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { AccountError, bearerFrom, clientIpFrom, executeAccountAction } = await import(
          "@/lib/account-admin.server"
        );
        if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          return Response.json({ error: "Account service is not available on this host" }, { status: 503 });
        }
        let body: { action?: string; payload?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        if (!body.action || !(ACCOUNT_ACTIONS as readonly string[]).includes(body.action)) {
          return Response.json({ error: "Unknown action" }, { status: 400 });
        }
        const ip = request.headers.get("x-dbs-client-ip") || clientIpFrom(request);
        try {
          const result = await executeAccountAction(
            body.action as AccountAction,
            body.payload,
            bearerFrom(request),
            ip,
          );
          return Response.json({ result }, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          if (error instanceof AccountError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          console.error("[account-admin]", error);
          return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
        }
      },
    },
  },
});
