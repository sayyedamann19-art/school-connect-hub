import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const appId = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] as
  string | undefined;
const vapidKey = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] as
  string | undefined;
const apiKey = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] as
  string | undefined;
const projectId = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] as
  string | undefined;

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" | "failed" };

/**
 * Registers this device for closed-app push alerts. Must be called from a
 * click handler — browsers ignore permission requests without a user gesture.
 */
let registrationInFlight: Promise<PushResult> | undefined;
export function enablePush(): Promise<PushResult> {
  registrationInFlight ??= registerDevice().finally(() => {
    registrationInFlight = undefined;
  });
  return registrationInFlight;
}
async function registerDevice(): Promise<PushResult> {
  const messagingSenderId = appId?.split(":")[1] ?? "";
  if (!apiKey || !projectId || !appId || !vapidKey || !messagingSenderId) {
    return { status: "not-configured" };
  }
  if (typeof window === "undefined" || !("Notification" in window) || !(await isSupported())) {
    return { status: "unsupported" };
  }
  if (window.top !== window.self) {
    return { status: "open-in-new-tab" };
  }

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    return { status: "denied" };
  }

  const firebaseConfig: FirebaseOptions = { apiKey, projectId, appId, messagingSenderId };
  const query = new URLSearchParams({
    apiKey,
    projectId,
    appId,
    messagingSenderId,
  }).toString();
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${query}`,
    { scope: "/firebase-cloud-messaging-push-scope/" },
  );
  await waitForPushWorker(serviceWorkerRegistration);
  const messaging = getMessaging(getApps().length ? getApp() : initializeApp(firebaseConfig));
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
  return token ? { status: "registered", token } : { status: "denied" };
}

/** Wait for this registration, never serviceWorker.ready (which can be the offline worker). */
export function waitForPushWorker(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active) return Promise.resolve();
  const worker = registration.installing ?? registration.waiting;
  if (!worker) return Promise.reject(new Error("Notification worker is unavailable"));
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      worker.removeEventListener("statechange", check);
      if (error) reject(error);
      else resolve();
    };
    const check = () => {
      if (worker.state === "activated") finish();
      else if (worker.state === "redundant") finish(new Error("Notification worker failed"));
    };
    const timeout = setTimeout(() => finish(new Error("Notification setup timed out")), 15000);
    worker.addEventListener("statechange", check);
    check();
  });
}

/** Invalidate the browser subscription even if server cleanup is temporarily unavailable. */
export async function disconnectPushDevice() {
  const registration = await navigator.serviceWorker?.getRegistration(
    "/firebase-cloud-messaging-push-scope/",
  );
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
}
