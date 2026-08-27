import { useCallback, useEffect, useState } from "react";

type PermissionState = "unsupported" | "default" | "granted" | "denied";

const ASKED_KEY = "school-connect:notification-prompted";

/**
 * Notification permission foundation.
 *
 * V1 only asks for permission and reports state; delivering push messages will
 * plug a messaging worker + subscription store in behind `requestPermission`.
 */
export function usePushPermission() {
  const [state, setState] = useState<PermissionState>("unsupported");

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

  /** Ask once on first open, after the user is signed in. */
  const requestOnFirstOpen = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (window.localStorage.getItem(ASKED_KEY)) return;
    await requestPermission();
  }, [requestPermission]);

  return { state, requestPermission, requestOnFirstOpen };
}
