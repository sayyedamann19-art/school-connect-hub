import {
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  House,
  Upload,
  UserRound,
  Users,
  Bell,
  History,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/hooks/use-auth";
import { schoolName } from "@/lib/brand";

export type NavPath =
  | "/parent"
  | "/parent/children"
  | "/parent/notifications"
  | "/parent/attendance"
  | "/parent/feedback"
  | "/parent/character"
  | "/teacher"
  | "/teacher/attendance"
  | "/admin"
  | "/admin/students"
  | "/admin/import"
  | "/admin/imports"
  | "/teacher/import"
  | "/account";

export type NavItem = {
  label: string;
  to: NavPath;
  icon: LucideIcon;
};

export const navByRole: Record<AppRole, NavItem[]> = {
  parent: [
    { label: "Home", to: "/parent", icon: House },
    { label: "Children", to: "/parent/children", icon: Users },
    { label: "Updates", to: "/parent/notifications", icon: Bell },
    { label: "Account", to: "/account", icon: UserRound },
  ],
  teacher: [
    { label: "Classes", to: "/teacher", icon: GraduationCap },
    { label: "Attendance", to: "/teacher/attendance", icon: CalendarCheck },
    { label: "Import", to: "/teacher/import", icon: Upload },
    { label: "Account", to: "/account", icon: UserRound },
  ],
  admin: [
    { label: "Overview", to: "/admin", icon: LayoutDashboard },
    { label: "Students", to: "/admin/students", icon: Users },
    { label: "Import", to: "/admin/import", icon: Upload },
    { label: "History", to: "/admin/imports", icon: History },
    { label: "Account", to: "/account", icon: UserRound },
  ],
};

export const roleLabel: Record<AppRole, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  parent: "Parent",
};

export const appName = schoolName;
