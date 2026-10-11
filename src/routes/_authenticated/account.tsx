import { createFileRoute } from "@tanstack/react-router";
import { Loader2, LogOut, ShieldCheck, Languages } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notifyPrefKey, useNotifyPref } from "@/hooks/use-parent-updates";
import { usePushPermission } from "@/hooks/use-push-permission";
import { setUpdateNotificationPref } from "@/lib/updates.functions";
import { useAuth, useSignOut } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useT, useI18n, LANGUAGES, type Lang } from "@/lib/i18n";

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
  const t = useT();
  const { user, primaryRole } = useAuth();
  const signOut = useSignOut();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const name =
    (user?.user_metadata?.["full_name"] as string | undefined) ?? user?.email ?? t("Account");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error(t("Password too short"), { description: t("Use at least 8 characters.") });
      return;
    }
    if (password !== confirm) {
      toast.error(t("Passwords don't match"));
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(t("Couldn't update your password"), { description: error.message });
      return;
    }
    setPassword("");
    setConfirm("");
    toast.success(t("Password updated"), {
      description: t("Use your new password next time you sign in."),
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">{t("My account")}</h1>

      <section className="card-surface flex items-center gap-4 p-5">
        <StudentAvatar name={name} tone="navy" className="size-14" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{name}</p>
          <p className="meta-text mt-0.5">
            {primaryRole ? t(roleLabel[primaryRole]) : t("No role assigned")}
          </p>
        </div>
      </section>

      <SectionCard title={t("Details on file")} description={t("Managed by the school office.")}>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="eyebrow">{t("Role")}</dt>
            <dd className="mt-1 font-semibold capitalize text-foreground">{primaryRole ?? "—"}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t("Phone on file")}</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {(user?.user_metadata?.["phone"] as string | undefined) ?? t("Contact the office")}
            </dd>
          </div>
        </dl>
      </SectionCard>

      {primaryRole === "parent" ? (
        <>
          <LanguageSettings />
          <NotificationSettings />
        </>
      ) : null}

      <SectionCard
        title={t("Change password")}
        description={t("Optional. Until you change it, your registered phone number remains your password.")}
      >
        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("New password")}</Label>
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
            <Label htmlFor="confirm-password">{t("Confirm new password")}</Label>
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
            {t("Update password")}
          </Button>
          <p className="meta-text flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {t("Passwords are stored securely — nobody at the school can read them.")}
          </p>
        </form>
      </SectionCard>

      <Button
        variant="outline"
        className="h-12 w-full rounded-xl text-danger sm:w-auto"
        onClick={() => void signOut()}
      >
        <LogOut className="mr-2 size-4" strokeWidth={1.75} />
        {t("Sign out")}
      </Button>
    </div>
  );
}

function LanguageSettings() {
  const { lang, setLang, t } = useI18n();
  const [loading, setLoading] = useState(false);

  const handleLangChange = async (newLang: string) => {
    setLoading(true);
    try {
      await setLang(newLang as Lang);
      toast.success(t("Language updated"));
    } catch (e) {
      toast.error(t("Couldn't save your language"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title={t("Language")} description={t("Preferred language for the parent portal.")}>
      <div className="max-w-sm">
        <Select value={lang} onValueChange={handleLangChange} disabled={loading}>
          <SelectTrigger className="h-12 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </SectionCard>
  );
}

function NotificationSettings() {
  const t = useT();
  const queryClient = useQueryClient();
  const pref = useNotifyPref();
  const push = usePushPermission();
  const save = useMutation({
    mutationFn: (notifyUpdates: boolean) => setUpdateNotificationPref({ data: { notifyUpdates } }),
    onSuccess: (_r, notifyUpdates) => {
      queryClient.setQueryData(notifyPrefKey, { notifyUpdates });
      toast.success(notifyUpdates ? t("Update alerts turned on") : t("Update alerts turned off"));
    },
    onError: () => toast.error(t("Couldn't save your choice. Please try again.")),
  });
  const on = pref.data?.notifyUpdates ?? true;

  return (
    <SectionCard
      title={t("Notifications")}
      description={t("New school updates always stay in the Updates page, even if alerts are off.")}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="notify-updates" className="text-sm">
            {t("Show a pop-up when the school publishes an update")}
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
            {push.registering ? t("Turning on…") : t("Alert me even when the app is closed")}
          </Button>
        ) : null}
        {on && push.pushStatus === "registered" ? (
          <p className="meta-text">{t("This device gets alerts even when the app is closed.")}</p>
        ) : null}
        {on && push.pushStatus === "open-in-new-tab" ? (
          <p className="meta-text">
            {t("Open the app in its own browser tab (or the installed app) to turn on closed-app alerts.")}
          </p>
        ) : null}
        {on && push.state === "denied" ? (
          <p className="meta-text">
            {t("Device alerts are blocked in your browser settings. You'll still see pop-ups inside the app.")}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
