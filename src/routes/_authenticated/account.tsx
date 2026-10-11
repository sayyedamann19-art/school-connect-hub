import { createFileRoute } from "@tanstack/react-router";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/common/section-card";
import { StudentAvatar } from "@/components/common/student-card";
import { roleLabel } from "@/components/layout/nav-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { notifyPrefKey, useNotifyPref } from "@/hooks/use-parent-updates";
import { usePushPermission } from "@/hooks/use-push-permission";
import { setUpdateNotificationPref } from "@/lib/updates.functions";
import { useAuth, useSignOut } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My account — Dawn Breakers School" },
      {
        name: "description",
        content:
          "Review the details Dawn Breakers School has on file and change your portal password whenever you like.",
      },
      { property: "og:title", content: "My account — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Review your details and change your Dawn Breakers School portal password.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, primaryRole } = useAuth();
  const signOut = useSignOut();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const name =
    (user?.user_metadata?.["full_name"] as string | undefined) ?? user?.email ?? "Account";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Password too short", { description: "Use at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error("Couldn't update your password", { description: error.message });
      return;
    }
    setPassword("");
    setConfirm("");
    toast.success("Password updated", {
      description: "Use your new password next time you sign in.",
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">My account</h1>

      <section className="card-surface flex items-center gap-4 p-5">
        <StudentAvatar name={name} tone="navy" className="size-14" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{name}</p>
          <p className="meta-text mt-0.5">
            {primaryRole ? roleLabel[primaryRole] : "No role assigned"}
          </p>
        </div>
      </section>

      <SectionCard title="Details on file" description="Managed by the school office.">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="eyebrow">Role</dt>
            <dd className="mt-1 font-semibold capitalize text-foreground">{primaryRole ?? "—"}</dd>
          </div>
          <div>
            <dt className="eyebrow">Phone on file</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {(user?.user_metadata?.["phone"] as string | undefined) ?? "Contact the office"}
            </dd>
          </div>
        </dl>
      </SectionCard>

      {primaryRole === "parent" ? <NotificationSettings /> : null}

      <SectionCard
        title="Change password"
        description="Optional. Until you change it, your registered phone number remains your password."
      >
        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className="h-12 rounded-xl"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              className="h-12 rounded-xl"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </div>
          <Button type="submit" className="h-12 rounded-xl" disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Update password
          </Button>
          <p className="meta-text flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            Passwords are stored securely — nobody at the school can read them.
          </p>
        </form>
      </SectionCard>

      <Button
        variant="outline"
        className="h-12 w-full rounded-xl text-danger sm:w-auto"
        onClick={() => void signOut()}
      >
        <LogOut className="mr-2 size-4" strokeWidth={1.75} />
        Sign out
      </Button>
    </div>
  );
}

function NotificationSettings() {
  const queryClient = useQueryClient();
  const pref = useNotifyPref();
  const push = usePushPermission();
  const save = useMutation({
    mutationFn: (notifyUpdates: boolean) => setUpdateNotificationPref({ data: { notifyUpdates } }),
    onSuccess: (_r, notifyUpdates) => {
      queryClient.setQueryData(notifyPrefKey, { notifyUpdates });
      toast.success(notifyUpdates ? "Update alerts turned on" : "Update alerts turned off");
    },
    onError: () => toast.error("Couldn't save your choice. Please try again."),
  });
  const on = pref.data?.notifyUpdates ?? true;

  return (
    <SectionCard
      title="Notifications"
      description="New school updates always stay in the Updates page, even if alerts are off."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="notify-updates" className="text-sm">
            Show a pop-up when the school publishes an update
          </Label>
          <Switch
            id="notify-updates"
            checked={on}
            disabled={pref.isLoading || save.isPending}
            onCheckedChange={(checked) => save.mutate(checked)}
          />
        </div>
        {on && push.pushStatus !== "registered" && push.state !== "denied" ? (
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            disabled={push.registering}
            onClick={() => void push.enableClosedAppAlerts()}
          >
            {push.registering ? "Turning on…" : "Alert me even when the app is closed"}
          </Button>
        ) : null}
        {on && push.pushStatus === "registered" ? (
          <p className="meta-text">This device gets alerts even when the app is closed.</p>
        ) : null}
        {on && push.pushStatus === "open-in-new-tab" ? (
          <p className="meta-text">
            Open the app in its own browser tab (or the installed app) to turn on closed-app
            alerts.
          </p>
        ) : null}
        {on && push.state === "denied" ? (
          <p className="meta-text">
            Device alerts are blocked in your browser settings. You'll still see pop-ups inside the
            app.
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
