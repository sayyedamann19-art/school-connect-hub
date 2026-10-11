import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useNotifyPref, useParentUpdates } from "@/hooks/use-parent-updates";
import { useStaffUpdates } from "@/hooks/use-staff-updates";
import { normalizeCategory } from "@/lib/updates.functions";
import { useT } from "@/lib/i18n";

const PARENT_KEY = "dawn-breakers:update-toasts-shown";

function loadShown(SHOWN_KEY: string): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SHOWN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveShown(SHOWN_KEY: string, ids: Set<string>) {
  window.localStorage.setItem(SHOWN_KEY, JSON.stringify(Array.from(ids).slice(-300)));
}

/**
 * Shows a pop-up for each newly published update the parent hasn't read yet.
 * Each update is announced at most once per device (edits and re-publishing keep the same id).
 */
export function UpdateNotifier({ staff }: { staff?: "admin" | "teacher" } = {}) {
  const t = useT();
  const navigate = useNavigate();
  const pref = useNotifyPref();
  const parentData = useParentUpdates(!staff);
  const staffData = useStaffUpdates(Boolean(staff));
  const { unread, updates } = staff ? staffData : parentData;
  const SHOWN_KEY = staff ? `dawn-breakers:staff-toasts-shown:${staff}` : PARENT_KEY;
  const baselined = useRef(false);

  useEffect(() => {
    if (!updates.isSuccess || !pref.isSuccess) return;
    const shown = loadShown(SHOWN_KEY);

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
      saveShown(SHOWN_KEY, shown);
      return;
    }
    fresh.forEach((u) => shown.add(u.id));
    saveShown(SHOWN_KEY, shown);
    if (!pref.data.notifyUpdates) return;

    const open = () =>
      void navigate({ to: staff ? `/${staff}/updates` : "/parent/notifications" } as never);
    const show = fresh.slice(0, 3);
    for (const u of show) {
      const label = t(normalizeCategory(u.category) === "holiday" ? "Holiday" : "Notice");
      toast(t("{label}: {title}", { label, title: u.title }), {
        description: staff
          ? t("From {sender}", { sender: u.sender_name })
          : u.body.length > 90
            ? `${u.body.slice(0, 90)}…`
            : u.body,
        duration: 10_000,
        action: { label: t("Open"), onClick: open },
      });
      if (
        document.visibilityState === "hidden" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(t("{label}: {title}", { label, title: u.title }), { body: u.body, tag: u.id });
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
      toast(t("{n} more new updates", { n: fresh.length - show.length }), {
        action: { label: t("View all"), onClick: open },
      });
    }
  }, [unread, updates.isSuccess, updates.data, pref.isSuccess, pref.data, navigate, staff, SHOWN_KEY, t]);

  return null;
}
