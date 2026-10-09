import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosts outside Lovable (e.g. Cloudflare Pages) may not inject the PUBLIC backend
// address/publishable key into the server runtime. Fall back to the same public
// values baked into the browser build. Never add private secrets here.
function ensurePublicBackendEnv(env: unknown) {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  g.process ??= {};
  g.process.env ??= {};
  const pe = g.process.env;
  const bindings = (env ?? {}) as Record<string, unknown>;
  const pick = (key: string, fallback: string | undefined) => {
    if (pe[key]) return;
    const fromBinding = bindings[key];
    pe[key] = typeof fromBinding === "string" && fromBinding ? fromBinding : fallback;
  };
  pick("SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL);
  pick("SUPABASE_PUBLISHABLE_KEY", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      ensurePublicBackendEnv(env);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
