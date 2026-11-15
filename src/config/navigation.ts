import {
  LayoutDashboard,
  UtensilsCrossed,
  Users,
  Wallet,
  BookOpenText,
  BarChart3,
  Settings,
  Mail,
  History,
  Receipt,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export const adminNavigation: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Daily Meal Entry",
    href: "/meals",
    icon: UtensilsCrossed,
  },
  {
    label: "Members",
    href: "/members",
    icon: Users,
  },
  {
    label: "Deposit & Balance",
    href: "/deposits",
    icon: Wallet,
  },
  {
    label: "Total Mill Ledger",
    href: "/ledger",
    icon: BookOpenText,
  },
  {
    label: "History & Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    label: "Email Reports",
    href: "/email-reports",
    icon: Mail,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export const memberNavigation: NavItem[] = [
  {
    label: "My Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Meal History",
    href: "/my-meals",
    icon: UtensilsCrossed,
  },
  {
    label: "Deposit History",
    href: "/my-deposits",
    icon: Wallet,
  },
  {
    label: "Personal Statement",
    href: "/my-statement",
    icon: Receipt,
  },
];

export const viewerNavigation: NavItem[] = [
  {
    label: "Group Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "History & Reports",
    href: "/reports",
    icon: BarChart3,
  },
];

export const navigationConfig: NavItem[] = adminNavigation;

export function getNavigationForRole(role: UserRole = "member"): NavItem[] {
  switch (role) {
    case "admin":
      return adminNavigation;
    case "group_ledger_viewer":
      return viewerNavigation;
    case "member":
    default:
      return memberNavigation;
  }
}
