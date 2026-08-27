import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, School, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { resolveParentLogin } from "@/lib/parent-auth.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — School Connect Parent & Teacher Portal" },
      {
        name: "description",
        content:
          "Secure sign-in for parents, teachers and school administrators to view attendance, teacher notes and character card progress.",
      },
      { property: "og:title", content: "Sign in — School Connect" },
      {
        property: "og:description",
        content:
          "Secure sign-in for parents, teachers and school administrators to view attendance, teacher notes and character card progress.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, rolesLoading, primaryRole, homePath } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [grNumber, setGrNumber] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleParentSignIn(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    // Generic failure messaging so the form can't be used to discover GR numbers.
    const failed = () =>
      toast.error("Couldn't sign in", {
        description: "Check the GR number and password, or contact the school office.",
      });
    try {
      const { email: alias } = await resolveParentLogin({ data: { loginId: grNumber.trim() } });
      if (!alias) {
        failed();
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: alias,
        password: parentPassword,
      });
      if (error) {
        failed();
        return;
      }
      toast.success("Signed in");
    } catch {
      failed();
    } finally {
      setSubmitting(false);
    }
  }

  // Signed-in users go straight to the area their role owns.
  useEffect(() => {
    if (!session || rolesLoading) return;
    navigate({ to: (primaryRole ? homePath : "/no-access") as "/parent", replace: true });
  }, [session, rolesLoading, primaryRole, homePath, navigate]);

  async function handleEmailSignIn(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't sign in", { description: error.message });
      return;
    }
    toast.success("Signed in");
  }

  async function handleGoogleSignIn() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed", { description: result.error.message });
      return;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <section className="hidden flex-1 flex-col justify-between bg-primary px-12 py-14 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/12">
            <School className="size-5" />
          </span>
          <span className="text-base font-semibold tracking-tight">School Connect</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            One clear view of every child's school day.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/80">
            Attendance, teacher notes and character card progress — shared securely between the
            school and the families it serves.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs text-primary-foreground/70">
          <ShieldCheck className="size-4" />
          Parents only ever see their own children's records.
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <School className="size-5" />
            </span>
            <span className="text-base font-semibold tracking-tight">School Connect</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the account the school office set up for you.
          </p>

          <Tabs defaultValue="parent" className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="parent">Parent</TabsTrigger>
              <TabsTrigger value="staff">Teacher / Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="parent">
              <form onSubmit={handleParentSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gr-number">GR Number (Login ID)</Label>
                  <Input
                    id="gr-number"
                    autoComplete="username"
                    required
                    value={grNumber}
                    onChange={(event) => setGrNumber(event.target.value)}
                    placeholder="202600145"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent-password">Password</Label>
                  <Input
                    id="parent-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={parentPassword}
                    onChange={(event) => setParentPassword(event.target.value)}
                    placeholder="Your registered phone number"
                  />
                  <p className="text-xs text-muted-foreground">
                    First time here? Use your registered phone number as the password. You can
                    change it later from My account.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="staff">
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@school.edu"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Sign in
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => void handleGoogleSignIn()}
              >
                Continue with Google
              </Button>
            </TabsContent>
          </Tabs>


          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            Accounts are created by the school. If you can't sign in, contact the school office.
          </p>
        </div>
      </section>
    </div>
  );
}
