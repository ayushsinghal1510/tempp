import type { NavItem } from "@/components/dashboard/SidebarNav";

export const STUDENT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/student", icon: "dashboard" },
  { label: "Companies", href: "/student/companies", icon: "companies" },
];

export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" },
  { label: "Cohorts", href: "/admin/cohorts", icon: "cohorts" },
  { label: "Students", href: "/admin/students", icon: "students" },
];

export const EDUCATOR_NAV: NavItem[] = [
  { label: "Dashboard", href: "/educator", icon: "dashboard" },
  { label: "Companies", href: "/educator/companies", icon: "companies" },
  { label: "Classes", href: "/educator/groups", icon: "cohorts" },
  { label: "Students", href: "/educator/students", icon: "students" },
];

export const SUPER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/super", icon: "dashboard" },
  { label: "Universities", href: "/super/universities", icon: "universities" },
];
