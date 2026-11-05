import { beforeEach, afterEach, expect, it, vi } from "vitest";
const test = vi.hoisted(() => ({
  effects: [] as (() => void)[],
  states: [] as any[],
  setters: [] as any[],
  enable: vi.fn(),
  register: vi.fn(),
}));
vi.mock("react", () => ({
  useCallback: (fn: any) => fn,
  useEffect: (fn: any) => {
    test.effects.push(fn);
  },
  useState: (initial: any) => {
    const index = test.states.length;
    test.states.push(initial);
    const set = (value: any) => {
      test.states[index] = value;
    };
    test.setters.push(set);
    return [initial, set];
  },
}));
vi.mock("@/lib/push", () => ({ enablePush: test.enable }));
vi.mock("@/lib/push.functions", () => ({ registerPushToken: test.register }));
import { usePushPermission } from "@/hooks/use-push-permission";
let storage: Map<string, string>;
beforeEach(() => {
  test.effects = [];
  test.states = [];
  test.setters = [];
  storage = new Map();
  vi.stubGlobal("window", {
    Notification: {},
    localStorage: {
      getItem: (key: string) => storage.get(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  vi.stubGlobal("Notification", { permission: "granted" });
  test.enable.mockReset().mockResolvedValue({ status: "registered", token: "token" });
  test.register.mockReset().mockResolvedValue({ ok: true });
});
afterEach(() => vi.unstubAllGlobals());
it("does not claim success from a cached token", () => {
  storage.set("dawn-breakers:push-token", "old");
  const hook = usePushPermission();
  test.effects[0]!();
  expect(hook.pushStatus).toBeNull();
  expect(test.states[1]).toBeNull();
});
it("waits for server confirmation before showing success or saving the token", async () => {
  let confirm!: () => void;
  test.register.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        confirm = resolve;
      }),
  );
  const hook = usePushPermission();
  const pending = hook.enableClosedAppAlerts();
  await Promise.resolve();
  expect(test.states[1]).toBeNull();
  expect(storage.size).toBe(0);
  confirm();
  await pending;
  expect(test.states[1]).toBe("registered");
  expect(storage.get("dawn-breakers:push-token")).toBe("token");
});
it("leaves registration retryable when the server rejects it", async () => {
  test.register.mockRejectedValue(new Error("unavailable"));
  const hook = usePushPermission();
  expect(await hook.enableClosedAppAlerts()).toBe("failed");
  expect(test.states[1]).toBe("failed");
  expect(test.states[2]).toBe(false);
  expect(storage.size).toBe(0);
});
