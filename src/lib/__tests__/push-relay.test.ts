import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  authorization: "Bearer caller-token",
  ready: true,
  deliver: vi.fn(),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => ({
    headers: new Headers(state.authorization ? { authorization: state.authorization } : {}),
  }),
}));
vi.mock("@/lib/push-delivery.server", () => ({
  pushProviderReady: async () => state.ready,
  deliverUpdatePush: state.deliver,
}));
import { runPushAction } from "../push-relay.server";
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  state.authorization = "Bearer caller-token";
  state.ready = true;
  state.deliver.mockReset();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("ACCOUNT_SERVICE_URL", "https://accounts.school.test");
  fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("relays only the caller's token over HTTPS without following redirects", async () => {
  await runPushAction({} as any, { action: "send", updateId: "update" });
  const [url, options] = fetchMock.mock.calls[0]!;
  expect(String(url)).toBe("https://accounts.school.test/api/public/push");
  expect(options.headers.authorization).toBe("Bearer caller-token");
  expect(options.redirect).toBe("manual");
  expect(JSON.parse(options.body)).toEqual({ action: "send", updateId: "update" });
});
it("does not contact a notification host for an unauthenticated request", async () => {
  state.authorization = "";
  await expect(runPushAction({} as any, { action: "status" })).rejects.toThrow("sign in");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("a missing or outdated relay never reports registration success", async () => {
  fetchMock.mockResolvedValue(new Response("Not found", { status: 404 }));
  await expect(runPushAction({} as any, { action: "status" })).rejects.toThrow("unavailable");
});
it("local delivery preserves the caller's database authorization context", async () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  const caller = {} as any;
  await runPushAction(caller, { action: "send", updateId: "update" });
  expect(state.deliver).toHaveBeenCalledWith(caller, "update");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("a local provider configuration failure is not treated as enabled", async () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  state.ready = false;
  await expect(runPushAction({} as any, { action: "status" })).rejects.toThrow("not connected");
  expect(state.deliver).not.toHaveBeenCalled();
});
