import { beforeEach, afterEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  getToken: vi.fn(),
  isSupported: vi.fn(),
  getMessaging: vi.fn(),
  initializeApp: vi.fn(),
  getApps: vi.fn(),
  getApp: vi.fn(),
}));
vi.mock("firebase/app", () => sdk);
vi.mock("firebase/messaging", () => sdk);
let registration: any;
let register: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  for (const [name, value] of Object.entries({
    APP_ID: "1:123:web:abc",
    VAPID_KEY: "vapid",
    WEB_API_KEY: "web-key",
    PROJECT_ID: "project",
  }))
    vi.stubEnv(`VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_${name}`, value);
  const window = {};
  Object.assign(window, { self: window, top: window, Notification: {} });
  vi.stubGlobal("window", window);
  vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn() });
  registration = { active: {}, scope: "https://school.test/firebase-cloud-messaging-push-scope/" };
  register = vi.fn().mockResolvedValue(registration);
  vi.stubGlobal("navigator", { serviceWorker: { register } });
  sdk.isSupported.mockResolvedValue(true);
  sdk.getApps.mockReturnValue([]);
  sdk.getToken.mockResolvedValue("device-token");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it("uses a separate scope and passes its registration to Firebase", async () => {
  const { enablePush } = await import("../push");
  expect(await enablePush()).toEqual({ status: "registered", token: "device-token" });
  expect(register).toHaveBeenCalledWith(expect.stringContaining("/firebase-messaging-sw.js?"), {
    scope: "/firebase-cloud-messaging-push-scope/",
  });
  expect(sdk.getToken).toHaveBeenCalledWith(undefined, {
    vapidKey: "vapid",
    serviceWorkerRegistration: registration,
  });
});
it("deduplicates simultaneous registration from account and app shell", async () => {
  const { enablePush } = await import("../push");
  await Promise.all([enablePush(), enablePush()]);
  expect(register).toHaveBeenCalledOnce();
});
it("does not request permission when configuration is missing", async () => {
  vi.stubEnv("VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY", "");
  const { enablePush } = await import("../push");
  expect(await enablePush()).toEqual({ status: "not-configured" });
  expect(register).not.toHaveBeenCalled();
});
it("waits for this worker's activation and detects failed installation", async () => {
  const { waitForPushWorker } = await import("../push");
  const installing = Object.assign(new EventTarget(), { state: "installing" });
  const pending = waitForPushWorker({ installing } as unknown as ServiceWorkerRegistration);
  installing.state = "redundant";
  installing.dispatchEvent(new Event("statechange"));
  await expect(pending).rejects.toThrow("Notification worker failed");
});
it("times out an installation instead of claiming alerts are enabled", async () => {
  vi.useFakeTimers();
  const { waitForPushWorker } = await import("../push");
  const pending = waitForPushWorker({
    installing: Object.assign(new EventTarget(), { state: "installing" }),
  } as unknown as ServiceWorkerRegistration);
  const assertion = expect(pending).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(15000);
  await assertion;
});
