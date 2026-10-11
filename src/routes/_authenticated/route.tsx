import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { BrandedLoadingScreen, ErrorState } from "@/components/common/states";
import { AppShell } from "@/components/layout/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
  // Shown only if restoring the session takes noticeable time; never artificially delayed.
  pendingMs: 150,
  pendingMinMs: 0,
  pendingComponent: () => <BrandedLoadingScreen />,
  errorComponent: () => (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <ErrorState
        title="We couldn't open the portal"
        description="Please check your connection and try again."
        onRetry={() => window.location.reload()}
      />
    </div>
  ),
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
