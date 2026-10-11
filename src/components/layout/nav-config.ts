import {
  Award,
  BookOpen,
  Bell,
  CalendarCheck,
  GraduationCap,
  History,
  Link2,
  House,
  LayoutDashboard,
  MessageSquareText,
  School,
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
  | "/parent/academics"
  | "/teacher/academics"
  | "/admin/academics"
  | "/teacher"
  | "/teacher/attendance"
  | "/teacher/feedback"
  | "/teacher/character"
  | "/teacher/updates"
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
  | "/teacher/parents"
  | "/account";

export type NavItem = {
  label: string;
  to: NavPath;
  icon: LucideIcon;
  /** Optional sidebar section heading this item belongs to. */
  group?: string;
  /** Extra paths that should highlight this item (e.g. pages reached through it). */
  alsoActive?: NavPath[];
};

export const navByRole: Record<AppRole, NavItem[]> = {
  parent: [
    { label: "Home", to: "/parent", icon: House },
    { label: "Account", to: "/account", icon: UserRound },
  ],
  teacher: [
    { label: "Classes", to: "/teacher", icon: GraduationCap },
    { label: "Attendance", to: "/teacher/attendance", icon: CalendarCheck },
    { label: "Feedback", to: "/teacher/feedback", icon: MessageSquareText },
    { label: "Character", to: "/teacher/character", icon: Award },
    { label: "Results", to: "/teacher/academics", icon: BookOpen },
    { label: "Updates", to: "/teacher/updates", icon: Bell },
    { label: "Parents", to: "/teacher/parents", icon: Link2 },
    { label: "Account", to: "/account", icon: UserRound },
  ],
  admin: [
    { label: "Overview", to: "/admin", icon: LayoutDashboard, group: "Overview" },
    { label: "Classes", to: "/admin/classes", icon: School, group: "School", alsoActive: ["/admin/students"] },
    { label: "Teachers", to: "/admin/teachers", icon: GraduationCap, group: "School" },
    { label: "Parents", to: "/admin/parents", icon: Link2, group: "School" },
    { label: "Attendance", to: "/admin/attendance", icon: CalendarCheck, group: "School" },
    { label: "Academics", to: "/admin/academics", icon: BookOpen, group: "School" },
    { label: "Updates", to: "/admin/updates", icon: Bell, group: "Communication" },
    { label: "History", to: "/admin/imports", icon: History, group: "More" },
    { label: "Account", to: "/account", icon: UserRound },
  ],
};

/** The phone bottom bar fits five items; the rest stay in the side menu. */
const bottomNavPaths: Record<AppRole, NavPath[]> = {
  parent: ["/parent", "/account"],
  teacher: [
    "/teacher",
    "/teacher/attendance",
    "/teacher/feedback",
    "/teacher/character",
    "/account",
  ],
  admin: ["/admin", "/admin/classes", "/admin/teachers", "/admin/parents", "/account"],
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
