import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SchoolLogo } from "@/components/brand/school-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { gateUrl, schoolMotto, schoolName } from "@/lib/brand";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { resolveParentLogin } from "@/lib/parent-auth.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Dawn Breakers School Parent & Teacher Portal" },
      {
        name: "description",
        content:
          "Secure sign-in for Dawn Breakers School parents, teachers and administrators — attendance, teacher feedback and character card progress in one place.",
      },
      { property: "og:title", content: "Sign in — Dawn Breakers School" },
      {
        property: "og:description",
        content:
          "Attendance, teacher feedback and character card progress, shared securely between Dawn Breakers School and its families.",
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
        description: "Check the GR number and phone number, or contact the school office.",
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
    }
  }

  function handleForgotPassword() {
    toast.info("Password help", {
      description:
        "The school office can reset your password. Call the office or visit the front desk with your GR number.",
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-primary">
      {/* School gate photograph: recognisable, gently softened for readability. */}
      <img
        src={gateUrl}
        alt="The Dawn Breakers School gate with the school crest"
        className="absolute inset-0 size-full object-cover object-[62%_28%] sm:object-center"
      />
      <div className="absolute inset-0 bg-primary/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/25 via-primary/45 to-primary/85" />

      <div className="relative flex min-h-screen flex-col px-5 pb-8 pt-12 sm:px-8 lg:flex-row lg:items-center lg:gap-16 lg:px-16">
        <header className="mx-auto w-full max-w-sm text-center lg:mx-0 lg:max-w-md lg:text-left">
          <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center">
            <span className="flex size-[5.5rem] items-center justify-center rounded-full bg-surface/95 p-2 shadow-[var(--shadow-float)] lg:size-24">
              <SchoolLogo className="size-full" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-primary-foreground sm:text-3xl">
                {schoolName}
              </h1>
              <p className="mt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-gold">
                {schoolMotto}
              </p>
            </div>
          </div>
          <p className="mx-auto mt-6 hidden max-w-sm text-sm leading-relaxed text-primary-foreground/85 lg:mx-0 lg:block">
            Attendance, teacher feedback and character card progress — shared securely between the
            school and the families it serves.
          </p>
        </header>

        <section className="mx-auto mt-8 w-full max-w-sm lg:mt-0">
          <div className="rounded-3xl border border-surface/25 bg-surface/97 p-6 shadow-[var(--shadow-float)] sm:p-7">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the account the school office set up for you.
            </p>

            <Tabs defaultValue="parent" className="mt-6">
              <TabsList className="grid w-full grid-cols-2 rounded-xl">
                <TabsTrigger value="parent" className="rounded-lg">
                  Parent
                </TabsTrigger>
                <TabsTrigger value="staff" className="rounded-lg">
                  Teacher / Admin
                </TabsTrigger>
              </TabsList>

              <TabsContent value="parent">
                <form onSubmit={handleParentSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="gr-number">GR Number</Label>
                    <Input
                      id="gr-number"
                      autoComplete="username"
                      inputMode="numeric"
                      required
                      className="h-12 rounded-xl"
                      value={grNumber}
                      onChange={(event) => setGrNumber(event.target.value)}
                      placeholder="202600145"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent-password">Parent Phone Number</Label>
                    <Input
                      id="parent-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="h-12 rounded-xl"
                      value={parentPassword}
                      onChange={(event) => setParentPassword(event.target.value)}
                      placeholder="Registered phone number"
                    />
                  </div>
                  <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Sign In
                  </Button>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="block w-full text-center text-xs font-semibold text-teal underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </button>
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
                      className="h-12 rounded-xl"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@dawnbreakers.edu"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="h-12 rounded-xl"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Sign In
                  </Button>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="block w-full text-center text-xs font-semibold text-teal underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </button>
                </form>

                <div className="my-5 flex items-center gap-3 text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>

                <Button
                  variant="outline"
                  className="h-12 w-full rounded-xl text-sm font-semibold"
                  onClick={() => void handleGoogleSignIn()}
                >
                  Continue with Google
                </Button>
              </TabsContent>
            </Tabs>
          </div>

          <p className="mt-5 flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-primary-foreground/80">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            Parents only ever see their own children's records.
          </p>
        </section>
      </div>
    </div>
  );
}
