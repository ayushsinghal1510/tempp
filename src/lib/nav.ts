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
  { label: "Report", href: "/educator/report", icon: "report" },
];

/**
 * The educator nav with the unit renamed for the tenant — "Companies" on the
 * interview track, "Scenarios" on the clinical one. Same routes either way;
 * only the label differs, since PracticeCompany backs both.
 */
export function educatorNav(unitPlural: string): NavItem[] {
  const label = unitPlural.charAt(0).toUpperCase() + unitPlural.slice(1);
  return EDUCATOR_NAV.map((item) =>
    item.href === "/educator/companies" ? { ...item, label } : item,
  );
}

export const SUPER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/super", icon: "dashboard" },
  { label: "Universities", href: "/super/universities", icon: "universities" },
];
