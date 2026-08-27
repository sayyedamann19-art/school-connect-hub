import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { LoadingCards } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useAuth, type AppRole } from "@/hooks/use-auth";

/**
 * UI-side role gate. The database is the real boundary: every table is behind
 * row-level security scoped to the signed-in user's role and relationships.
 */
export function RoleGate({ role, children }: { role: AppRole; children: ReactNode }) {
  const { rolesLoading, hasRole, primaryRole, homePath } = useAuth();

  if (rolesLoading) return <LoadingCards count={3} />;

  if (!hasRole(role)) {
    return (
      <div className="card-surface mx-auto max-w-md px-6 py-10 text-center">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-warning-soft text-warning-foreground">
          <ShieldAlert className="size-5" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">This area is restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {primaryRole
            ? "Your account doesn't have access to this part of the school portal."
            : "No role has been assigned to your account yet. Please ask the school office to set it up."}
        </p>
        {primaryRole ? (
          <Button asChild className="mt-5">
            <Link to={homePath as "/parent"}>Go to my area</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
