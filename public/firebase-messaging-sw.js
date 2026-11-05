// Keep click handling ahead of Firebase imports so Firebase cannot replace it.
self.addEventListener("notificationclick", (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  const data = event.notification.data;
  const requestedPath = data?.path ?? data?.FCM_MSG?.data?.path ?? "/account";
  const target = new URL(requestedPath, self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === target.origin && "focus" in client) {
          await client.navigate(target.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});

// Dedicated scope: this worker never replaces the app's offline worker.
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");
const config = Object.fromEntries(new URL(self.location).searchParams);
if (config.apiKey && config.projectId && config.appId && config.messagingSenderId) {
  firebase.initializeApp(config);
  firebase.messaging().onBackgroundMessage((payload) => {
    // Firebase already displays notification payloads. Only data-only messages need this.
    if (payload.notification) return;
    const title = payload.data?.title ?? "Dawn Breakers School";
    return self.registration.showNotification(title, {
      body: payload.data?.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.data?.updateId ?? title,
      data: { path: payload.data?.path ?? "/account" },
    });
  });
}
