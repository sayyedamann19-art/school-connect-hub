import { GraduationCap, LayoutDashboard, School, Users, type LucideIcon } from "lucide-react";

import type { AppRole } from "@/hooks/use-auth";

export type NavItem = {
  label: string;
  to: "/parent" | "/teacher" | "/admin";
  icon: LucideIcon;
};

export const navByRole: Record<AppRole, NavItem[]> = {
  parent: [{ label: "My children", to: "/parent", icon: Users }],
  teacher: [{ label: "My classes", to: "/teacher", icon: GraduationCap }],
  admin: [{ label: "School overview", to: "/admin", icon: LayoutDashboard }],
};

export const roleLabel: Record<AppRole, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  parent: "Parent",
};

export const appName = "School Connect";
export const appIcon = School;
