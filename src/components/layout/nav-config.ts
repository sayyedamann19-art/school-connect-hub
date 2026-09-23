import {
  Award,
  Bell,
  CalendarCheck,
  GraduationCap,
  History,
  Link2,
  House,
  LayoutDashboard,
  MessageSquareText,
  School,
  Upload,
  UserRound,
  Users,
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
  | "/teacher/feedback"
  | "/teacher/character"
  | "/admin"
  | "/admin/students"
  | "/admin/classes"
  | "/admin/teachers"
  | "/admin/import"
  | "/admin/imports"
  | "/admin/parents"
  | "/admin/updates"
  | "/admin/attendance"
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
    { label: "Attendance", to: "/parent/attendance", icon: CalendarCheck },
    { label: "Feedback", to: "/parent/feedback", icon: MessageSquareText },
    { label: "Character", to: "/parent/character", icon: Award },
    { label: "Updates", to: "/parent/notifications", icon: Bell },
    { label: "Account", to: "/account", icon: UserRound },
  ],
  teacher: [
    { label: "Classes", to: "/teacher", icon: GraduationCap },
    { label: "Attendance", to: "/teacher/attendance", icon: CalendarCheck },
    { label: "Feedback", to: "/teacher/feedback", icon: MessageSquareText },
    { label: "Character", to: "/teacher/character", icon: Award },
    { label: "Import", to: "/teacher/import", icon: Upload },
    { label: "Account", to: "/account", icon: UserRound },
  ],
  admin: [
    { label: "Overview", to: "/admin", icon: LayoutDashboard },
    { label: "Students", to: "/admin/students", icon: Users },
    { label: "Classes", to: "/admin/classes", icon: School },
    { label: "Teachers", to: "/admin/teachers", icon: GraduationCap },
    { label: "Parents", to: "/admin/parents", icon: Link2 },
    { label: "Attendance", to: "/admin/attendance", icon: CalendarCheck },
    { label: "Updates", to: "/admin/updates", icon: Bell },
    { label: "Import", to: "/admin/import", icon: Upload },
    { label: "History", to: "/admin/imports", icon: History },
    { label: "Account", to: "/account", icon: UserRound },
  ],
};

/** The phone bottom bar fits five items; the rest stay in the side menu. */
const bottomNavPaths: Record<AppRole, NavPath[]> = {
  parent: ["/parent", "/parent/children", "/parent/attendance", "/parent/notifications", "/account"],
  teacher: [
    "/teacher",
    "/teacher/attendance",
    "/teacher/feedback",
    "/teacher/character",
    "/account",
  ],
  admin: ["/admin", "/admin/students", "/admin/classes", "/admin/teachers", "/account"],
};

export const bottomNavByRole: Record<AppRole, NavItem[]> = {
  parent: bottomNavPaths.parent.flatMap((path) => navByRole.parent.filter((item) => item.to === path)),
  teacher: bottomNavPaths.teacher.flatMap((path) =>
    navByRole.teacher.filter((item) => item.to === path),
  ),
  admin: bottomNavPaths.admin.flatMap((path) => navByRole.admin.filter((item) => item.to === path)),
};

export const roleLabel: Record<AppRole, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  parent: "Parent",
};

export const appName = schoolName;
