import { useCallback, useEffect, useState } from "react";

import { enablePush, type PushResult } from "@/lib/push";
import { registerPushToken } from "@/lib/push.functions";

type PermissionState = "unsupported" | "default" | "granted" | "denied";

const ASKED_KEY = "dawn-breakers:notification-prompted";
const TOKEN_KEY = "dawn-breakers:push-token";

/**
 * Notification permission + closed-app push registration.
 *
 * `requestPermission` asks for browser permission (in-app pop-ups).
 * `enableClosedAppAlerts` additionally registers this device for push
 * delivery while the app is closed, and saves the device token server-side.
 */
export function usePushPermission() {
  const [state, setState] = useState<PermissionState>("unsupported");
  const [pushStatus, setPushStatus] = useState<PushResult["status"] | null>(null);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as PermissionState);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    const result = (await Notification.requestPermission()) as PermissionState;
    window.localStorage.setItem(ASKED_KEY, "1");
    setState(result);
    return result;
  }, []);

  const enableClosedAppAlerts = useCallback(async (): Promise<PushResult["status"]> => {
    setRegistering(true);
    try {
      const result = await enablePush();
      if (result.status === "registered") {
        await registerPushToken({ data: { token: result.token } });
        window.localStorage.setItem(TOKEN_KEY, result.token);
        window.localStorage.setItem(ASKED_KEY, "1");
        setState("granted");
      } else if (result.status === "denied") {
        setState("denied");
      }
      setPushStatus(result.status);
      return result.status;
    } catch {
      setPushStatus("failed");
      return "failed";
    } finally {
      setRegistering(false);
    }
  }, []);

  useEffect(() => {
    if (
      "Notification" in window &&
      Notification.permission === "granted" &&
      window.localStorage.getItem(TOKEN_KEY)
    ) {
      void enableClosedAppAlerts();
    }
  }, [enableClosedAppAlerts]);

  /** Ask once on first open, after the user is signed in. */
  const requestOnFirstOpen = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (window.localStorage.getItem(ASKED_KEY)) return;
    await requestPermission();
  }, [requestPermission]);

  return {
    state,
    pushStatus,
    registering,
    requestPermission,
    enableClosedAppAlerts,
    requestOnFirstOpen,
  };
}
