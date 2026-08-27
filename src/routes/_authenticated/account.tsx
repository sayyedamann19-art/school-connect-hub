import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My account — School Connect" },
      {
        name: "description",
        content:
          "Update the password for your School Connect account. Changing it is optional — your phone number keeps working until you do.",
      },
      { property: "og:title", content: "My account — School Connect" },
      {
        property: "og:description",
        content: "Update the password for your School Connect account.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, primaryRole } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

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
    toast.success("Password updated", { description: "Use your new password next time you sign in." });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My account"
        description="Your sign-in details are managed by the school. You can change your password whenever you like."
      />

      <SectionCard title="Account" description="Details the school has on file.">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium capitalize text-foreground">{primaryRole ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phone on file</dt>
            <dd className="font-medium text-foreground">
              {(user?.user_metadata?.["phone"] as string | undefined) ?? "Contact the office"}
            </dd>
          </div>
        </dl>
      </SectionCard>

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
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Update password
          </Button>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            Passwords are stored securely by the school's authentication service — nobody at the
            school can read them.
          </p>
        </form>
      </SectionCard>
    </div>
  );
}
