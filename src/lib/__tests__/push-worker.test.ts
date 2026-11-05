import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

function worker() {
  const handlers: Record<string, (e: any) => any> = {};
  const display = vi.fn().mockResolvedValue(undefined);
  let background: (p: any) => any = () => {};
  let clickBeforeFirebase = false;
  const self = {
    location: new URL(
      "https://school.test/firebase-messaging-sw.js?apiKey=a&projectId=p&appId=i&messagingSenderId=s",
    ),
    addEventListener: (name: string, fn: any) => {
      handlers[name] = fn;
    },
    registration: { showNotification: display },
    clients: {
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue(undefined),
    },
  };
  runInNewContext(readFileSync("public/firebase-messaging-sw.js", "utf8"), {
    self,
    URL,
    importScripts: () => {
      clickBeforeFirebase = Boolean(handlers["notificationclick"]);
    },
    firebase: {
      initializeApp: vi.fn(),
      messaging: () => ({
        onBackgroundMessage: (fn: any) => {
          background = fn;
        },
      }),
    },
  });
  return {
    self,
    display,
    clickBeforeFirebase,
    background: (p: any) => background(p),
    click: (path: string, fcm = false) => {
      let pending = Promise.resolve();
      handlers["notificationclick"]!({
        stopImmediatePropagation: vi.fn(),
        notification: { close: vi.fn(), data: fcm ? { FCM_MSG: { data: { path } } } : { path } },
        waitUntil: (p: Promise<void>) => {
          pending = p;
        },
      });
      return pending;
    },
  };
}
it("does not duplicate Firebase's automatic notification", () => {
  const w = worker();
  w.background({ notification: { title: "Notice", body: "Test" }, data: { updateId: "u" } });
  expect(w.display).not.toHaveBeenCalled();
  expect(w.clickBeforeFirebase).toBe(true);
});
it("keeps data-only display alive until the notification has been shown", async () => {
  const w = worker();
  await w.background({
    data: { title: "Notice", body: "Test", path: "/teacher/updates", updateId: "u" },
  });
  expect(w.display).toHaveBeenCalledWith(
    "Notice",
    expect.objectContaining({ tag: "u", data: { path: "/teacher/updates" } }),
  );
});
it("opens the correct staff inbox for automatic Firebase notifications", async () => {
  const w = worker();
  await w.click("/admin/updates", true);
  expect(w.self.clients.openWindow).toHaveBeenCalledWith("https://school.test/admin/updates");
});
it("does not navigate outside the school app", async () => {
  const w = worker();
  await w.click("https://other.test/");
  expect(w.self.clients.openWindow).not.toHaveBeenCalled();
});
it("awaits navigation before focusing an existing school window", async () => {
  const w = worker();
  const focus = vi.fn();
  const navigate = vi.fn().mockImplementation(async () => {
    expect(focus).not.toHaveBeenCalled();
  });
  w.self.clients.matchAll.mockResolvedValue([
    { url: "https://school.test/admin", navigate, focus },
  ]);
  await w.click("/parent/notifications");
  expect(navigate).toHaveBeenCalledWith("https://school.test/parent/notifications");
  expect(focus).toHaveBeenCalledOnce();
});
