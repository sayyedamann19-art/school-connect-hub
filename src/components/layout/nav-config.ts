import {
  GraduationCap,
  LayoutDashboard,
  School,
  Upload,
  UserCog,
  Users,
  History,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/hooks/use-auth";

export type NavItem = {
  label: string;
  to:
    | "/parent"
    | "/teacher"
    | "/admin"
    | "/admin/students"
    | "/admin/import"
    | "/admin/imports"
    | "/teacher/import"
    | "/account";
  icon: LucideIcon;
};

export const navByRole: Record<AppRole, NavItem[]> = {
  parent: [
    { label: "My children", to: "/parent", icon: Users },
    { label: "My account", to: "/account", icon: UserCog },
  ],
  teacher: [
    { label: "My classes", to: "/teacher", icon: GraduationCap },
    { label: "Import students", to: "/teacher/import", icon: Upload },
    { label: "My account", to: "/account", icon: UserCog },
  ],
  admin: [
    { label: "School overview", to: "/admin", icon: LayoutDashboard },
    { label: "Students", to: "/admin/students", icon: Users },
    { label: "Import students", to: "/admin/import", icon: Upload },
    { label: "Import history", to: "/admin/imports", icon: History },
    { label: "My account", to: "/account", icon: UserCog },
  ],
};

export const roleLabel: Record<AppRole, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  parent: "Parent",
};

export const appName = "School Connect";
export const appIcon = School;
