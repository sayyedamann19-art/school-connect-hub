import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  ready: true,
  senderAdmin: false,
  claim: true,
  calls: [] as string[],
  devices: [] as any[],
  profiles: [] as any[],
  roles: [] as any[],
  teachers: [] as any[],
  send: vi.fn(),
}));
vi.mock("@/lib/fcm.server", () => ({
  readServiceAccount: () => (state.ready ? { project_id: "test" } : null),
  sendToDevice: state.send,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      state.calls.push(table);
      const query = {
        select: () => query,
        order: () => query,
        range: async (start: number, end: number) => ({
          data: state.devices.slice(start, end + 1),
          error: null,
        }),
        in: async () => ({
          data:
            table === "profiles"
              ? state.profiles
              : table === "user_roles"
                ? state.roles
                : state.teachers,
          error: null,
        }),
      };
      return query;
    },
  },
}));
import { deliverUpdatePush } from "../push-delivery.server";
const rpc = vi.fn(async (name: string) => {
  state.calls.push(name);
  return {
    error: null,
    data:
      name === "get_update_senders"
        ? [{ sender_is_admin: state.senderAdmin }]
        : state.claim
          ? [{ id: "update", title: "Test", body: "Body", category: "notice" }]
          : [],
  };
});
const caller = { rpc } as any;
beforeEach(() => {
  state.ready = true;
  state.senderAdmin = false;
  state.claim = true;
  state.calls = [];
  state.devices = ["p", "t", "a", "off", "removed"].map((id) => ({
    id,
    user_id: id,
    token: `token-${id}`,
  }));
  state.profiles = state.devices.map((r) => ({ id: r.id, notify_updates: r.id !== "off" }));
  state.roles = [
    { user_id: "p", role: "parent" },
    { user_id: "t", role: "teacher" },
    { user_id: "a", role: "admin" },
    { user_id: "off", role: "parent" },
    { user_id: "removed", role: "teacher" },
  ];
  state.teachers = [
    { profile_id: "t", is_active: true, deleted_at: null },
    { profile_id: "removed", is_active: false, deleted_at: "2026-01-01" },
  ];
  state.send.mockReset().mockResolvedValue(undefined);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  vi.stubEnv("LOVABLE_API_KEY", "");
  vi.stubEnv("FIREBASE_MESSAGING_API_KEY", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("teacher publication alerts parents and admins with their own inbox links", async () => {
  await deliverUpdatePush(caller, "update");
  expect(state.send.mock.calls.map((c) => c[1].token)).toEqual(["token-p", "token-a"]);
  expect(state.send.mock.calls.map((c) => c[1].path)).toEqual([
    "/parent/notifications",
    "/admin/updates",
  ]);
});
it("admin publication alerts parents and active teachers, respecting opt-outs", async () => {
  state.senderAdmin = true;
  await deliverUpdatePush(caller, "update");
  expect(state.send.mock.calls.map((c) => c[1].token)).toEqual(["token-p", "token-t"]);
});
it("does not claim an update when the provider is missing", async () => {
  state.ready = false;
  await deliverUpdatePush(caller, "update");
  expect(state.calls).not.toContain("claim_update_push");
  expect(state.send).not.toHaveBeenCalled();
});
it("cannot bypass the caller's authorization or once-only claim", async () => {
  state.claim = false;
  await deliverUpdatePush(caller, "update");
  expect(state.send).not.toHaveBeenCalled();
  expect(state.calls).not.toContain("push_tokens");
});
it("delivery failures are reported without failing publication", async () => {
  state.send.mockRejectedValue(new Error("offline"));
  await expect(deliverUpdatePush(caller, "update")).resolves.toBeUndefined();
  expect(console.error).toHaveBeenCalledWith("Push delivery failed:", expect.any(Error));
});
it("pages beyond the first recipient batch", async () => {
  state.devices = Array.from({ length: 201 }, (_, i) => ({
    id: `${i}`,
    token: `${i}`,
    user_id: "p",
  }));
  await deliverUpdatePush(caller, "update");
  expect(state.send).toHaveBeenCalledTimes(201);
});
