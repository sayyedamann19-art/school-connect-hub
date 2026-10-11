import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useNotifyPref, useParentUpdates } from "@/hooks/use-parent-updates";
import { normalizeCategory } from "@/lib/updates.functions";

const SHOWN_KEY = "dawn-breakers:update-toasts-shown";

function loadShown(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SHOWN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveShown(ids: Set<string>) {
  window.localStorage.setItem(SHOWN_KEY, JSON.stringify(Array.from(ids).slice(-300)));
}

/**
 * Shows a pop-up for each newly published update the parent hasn't read yet.
 * Each update is announced at most once per device (edits and re-publishing keep the same id).
 */
export function UpdateNotifier() {
  const navigate = useNavigate();
  const pref = useNotifyPref();
  const { unread, updates } = useParentUpdates();
  const baselined = useRef(false);

  useEffect(() => {
    if (!updates.isSuccess || !pref.isSuccess) return;
    const shown = loadShown();

    // First load on this device: only announce updates from the last 3 days, not the whole history.
    if (!baselined.current && shown.size === 0) {
      const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
      for (const u of updates.data ?? []) {
        const when = new Date(u.first_published_at ?? u.published_at ?? u.created_at).getTime();
        if (when < cutoff) shown.add(u.id);
      }
    }
    baselined.current = true;

    const fresh = unread.filter((u) => !shown.has(u.id));
    if (fresh.length === 0) {
      saveShown(shown);
      return;
    }
    fresh.forEach((u) => shown.add(u.id));
    saveShown(shown);
    if (!pref.data.notifyUpdates) return;

    const open = () => void navigate({ to: "/parent/notifications" });
    const show = fresh.slice(0, 3);
    for (const u of show) {
      const label = normalizeCategory(u.category) === "holiday" ? "Holiday" : "Notice";
      toast(`${label}: ${u.title}`, {
        description: u.body.length > 90 ? `${u.body.slice(0, 90)}…` : u.body,
        duration: 10_000,
        action: { label: "Open", onClick: open },
      });
      if (
        document.visibilityState === "hidden" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(`${label}: ${u.title}`, { body: u.body, tag: u.id });
          n.onclick = () => {
            window.focus();
            open();
          };
        } catch {
          // Some mobile browsers only allow notifications from a service worker.
        }
      }
    }
    if (fresh.length > show.length) {
      toast(`${fresh.length - show.length} more new updates`, {
        action: { label: "View all", onClick: open },
      });
    }
  }, [unread, updates.isSuccess, updates.data, pref.isSuccess, pref.data, navigate]);

  return null;
}
