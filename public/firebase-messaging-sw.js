// Firebase Cloud Messaging worker — receives push notifications while the app
// is closed or in the background. Config arrives via the query string because
// a service worker cannot read import.meta.env.
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const config = Object.fromEntries(new URL(self.location).searchParams);
if (config.apiKey && config.projectId && config.appId && config.messagingSenderId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? payload.data?.title ?? "Dawn Breakers School";
    const body = payload.notification?.body ?? payload.data?.body ?? "";
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.data?.updateId ?? title,
      data: { path: payload.data?.path ?? "/parent/notifications" },
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.path ?? "/parent/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(path);
          return client.focus();
        }
      }
      return self.clients.openWindow(path);
    }),
  );
});
