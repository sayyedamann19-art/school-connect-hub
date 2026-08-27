import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "teacher" | "parent";

export const roleHomePath: Record<AppRole, string> = {
  admin: "/admin",
  teacher: "/teacher",
  parent: "/parent",
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roles: AppRole[];
  rolesLoading: boolean;
  primaryRole: AppRole | null;
  hasRole: (role: AppRole) => boolean;
  homePath: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_PRIORITY: AppRole[] = ["admin", "teacher", "parent"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      return (data ?? []).map((row) => row.role as AppRole);
    },
  });

  const value = useMemo<AuthContextValue>(() => {
    const primaryRole = ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null;
    return {
      session,
      user: session?.user ?? null,
      loading,
      roles,
      rolesLoading,
      primaryRole,
      hasRole: (role: AppRole) => roles.includes(role),
      homePath: primaryRole ? roleHomePath[primaryRole] : "/no-access",
    };
  }, [session, loading, roles, rolesLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** Sign out cleanly: stop in-flight queries, clear cache, then leave the app shell. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
}
