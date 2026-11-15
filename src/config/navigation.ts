import {
  LayoutDashboard,
  UtensilsCrossed,
  Users,
  Wallet,
  BookOpenText,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const navigationConfig: NavItem[] = [
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
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];
