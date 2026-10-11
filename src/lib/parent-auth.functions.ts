import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Parent sign-in with a GR number. The password check happens on the server; the
 * browser only ever receives session tokens, never the hidden login email, and every
 * failure (unknown GR, no parent, wrong password, too many tries) returns the same message.
 */
export const parentSignIn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ grNumber: z.string().trim().min(1).max(32), password: z.string().min(1).max(72) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { runAccountAction, clientIpFrom } = await import("@/lib/account-admin.server");
    const { GENERIC_SIGN_IN_ERROR } = await import("@/lib/account-rules");
    try {
      const session = await runAccountAction<{ access_token: string; refresh_token: string }>(
        "parent_sign_in",
        data,
        { token: null, ip: clientIpFrom(getRequest()) },
      );
      return { ok: true as const, session };
    } catch (error) {
      const status = (error as { status?: number }).status;
      return {
        ok: false as const,
        error: status === 401 ? GENERIC_SIGN_IN_ERROR : "Sign-in is unavailable right now. Please try again.",
      };
    }
  });
