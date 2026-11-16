"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Wheat,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  LayoutDashboard,
  UtensilsCrossed,
  Users,
  Wallet,
  MoreHorizontal,
} from "lucide-react";
import { navigationConfig, getNavigationForRole, NavItem } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { RealtimeProvider, useRealtime } from "@/lib/realtime/realtime-provider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { invalidateCache } from "@/lib/services";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";
import { UserRole } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface AppShellProps {
  children: React.ReactNode;
  userRole?: UserRole;
  userEmail?: string;
  memberName?: string;
  memberId?: string | null;
}

function RealtimeStatusBadge() {
  const { connectionState } = useRealtime();

  if (connectionState === "connected") {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
        title="Real-time live sync connected"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="hidden sm:inline">Live</span>
      </div>
    );
  }

  if (connectionState === "connecting") {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
        title="Connecting to real-time sync..."
      >
        <span className="inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
        <span className="hidden sm:inline">Syncing</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border"
      title="Offline / Reconnecting"
    >
      <span className="inline-flex rounded-full h-2 w-2 bg-muted-foreground/60"></span>
      <span className="hidden sm:inline">Offline</span>
    </div>
  );
}

export function AppShell({
  children,
  userRole = "admin",
  userEmail,
  memberName,
  memberId,
}: AppShellProps) {
  return (
    <RealtimeProvider
      userRole={userRole}
      memberId={memberId}
      userEmail={userEmail}
    >
      <AppShellInner
        userRole={userRole}
        userEmail={userEmail}
        memberName={memberName}
      >
        {children}
      </AppShellInner>
    </RealtimeProvider>
  );
}

function AppShellInner({
  children,
  userRole = "admin",
  userEmail,
  memberName,
}: Omit<AppShellProps, "memberId">) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const navItems: NavItem[] = React.useMemo(() => {
    return getNavigationForRole(userRole);
  }, [userRole]);

  // Automatic logout on inactivity (15 mins with 1 min advance alert)
  useInactivityLogout();

  // Client-side route guard for non-admin roles
  const isUnauthorized = React.useMemo(() => {
    if (userRole === "member") {
      return !["/", "/my-meals", "/my-deposits", "/my-statement"].includes(pathname);
    }
    if (userRole === "group_ledger_viewer") {
      return !["/", "/reports"].includes(pathname);
    }
    return false;
  }, [userRole, pathname]);

  React.useEffect(() => {
    if (isUnauthorized) {
      toast.error(
        userRole === "member"
          ? "Access restricted. Redirecting to personal dashboard..."
          : "Access restricted. Redirecting to aggregate dashboard..."
      );
      router.replace("/");
    }
  }, [isUnauthorized, userRole, router]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      invalidateCache();
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to logout";
      toast.error(message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Helper for role label in header
  const roleDisplay = React.useMemo(() => {
    switch (userRole) {
      case "admin":
        return {
          title: "Admin Private Session",
          badge: "Administrator",
          color: "text-emerald-600 dark:text-emerald-400",
        };
      case "group_ledger_viewer":
        return {
          title: "Group Ledger Audit Session",
          badge: "Aggregate Viewer",
          color: "text-blue-600 dark:text-blue-400",
        };
      case "member":
      default:
        return {
          title: memberName ? `${memberName}'s Member Portal` : "Member Portal",
          badge: "Member",
          color: "text-primary",
        };
    }
  }, [userRole, memberName]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row w-full overflow-x-hidden">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col md:fixed md:inset-y-0 border-r border-border bg-card z-30 transition-all duration-200",
          isCollapsed ? "md:w-20" : "md:w-64"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2.5 overflow-hidden transition-all",
              isCollapsed ? "justify-center w-full" : "justify-start"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wheat className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm tracking-tight text-foreground truncate">
                  {siteConfig.name}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Mill Manager
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors group",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer with Collapse & Logout Buttons */}
        <div className="p-3 border-t border-border space-y-2">
          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer",
              isCollapsed && "justify-center"
            )}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            isLoading={isLoggingOut}
            className={cn(
              "w-full text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 text-xs",
              isCollapsed && "justify-center px-0"
            )}
            title="Log out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden sticky top-0 z-40 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-card/95 backdrop-blur-md px-3.5 sm:px-4">
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open mobile menu"
            className="text-foreground -ml-1 h-9 w-9"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2 text-primary font-bold text-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wheat className="h-4 w-4" />
            </div>
            <span className="text-foreground font-semibold truncate text-sm">
              {siteConfig.name}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <RealtimeStatusBadge />
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div className="relative w-72 max-w-[85vw] flex flex-col bg-card border-r border-border p-5 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-border">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Wheat className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-foreground font-bold">{siteConfig.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase font-medium">Mill Manager</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close mobile menu"
                className="h-8 w-8 -mr-1"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="mt-3 flex-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-3.5 border-t border-border space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>Theme Mode</span>
                <ThemeToggle />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                isLoading={isLoggingOut}
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive justify-start gap-2 text-xs h-9"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout Session</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Thumb Friendly & Role Aware) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border flex items-center justify-around h-15 px-2 safe-bottom">
        <Link
          href="/"
          className={cn(
            "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
            pathname === "/"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutDashboard className="h-4.5 w-4.5 mb-0.5" />
          <span>Home</span>
        </Link>

        {userRole === "admin" && (
          <>
            <Link
              href="/meals"
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
                pathname === "/meals" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <UtensilsCrossed className="h-4.5 w-4.5 mb-0.5" />
              <span>Meals</span>
            </Link>

            <Link
              href="/deposits"
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
                pathname === "/deposits" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Wallet className="h-4.5 w-4.5 mb-0.5" />
              <span>Deposits</span>
            </Link>

            <Link
              href="/members"
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
                pathname === "/members" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-4.5 w-4.5 mb-0.5" />
              <span>Members</span>
            </Link>
          </>
        )}

        {userRole === "member" && (
          <>
            <Link
              href="/my-meals"
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
                pathname === "/my-meals" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <UtensilsCrossed className="h-4.5 w-4.5 mb-0.5" />
              <span>Meals</span>
            </Link>

            <Link
              href="/my-deposits"
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
                pathname === "/my-deposits" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Wallet className="h-4.5 w-4.5 mb-0.5" />
              <span>Deposits</span>
            </Link>

            <Link
              href="/my-statement"
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
                pathname === "/my-statement" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-4.5 w-4.5 mb-0.5" />
              <span>Statement</span>
            </Link>
          </>
        )}

        {userRole === "group_ledger_viewer" && (
          <>
            <Link
              href="/"
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
                pathname === "/" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutDashboard className="h-4.5 w-4.5 mb-0.5" />
              <span>Aggregate</span>
            </Link>

            <Link
              href="/reports"
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
                pathname === "/reports" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Wallet className="h-4.5 w-4.5 mb-0.5" />
              <span>Reports</span>
            </Link>
          </>
        )}

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <MoreHorizontal className="h-4.5 w-4.5 mb-0.5" />
          <span>Menu</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-200 min-w-0 w-full",
          isCollapsed ? "md:pl-20" : "md:pl-64"
        )}
      >
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 items-center justify-between px-6 lg:px-8 border-b border-border bg-card/60 backdrop-blur-xs sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className={cn("h-4 w-4", roleDisplay.color)} />
            <span className="font-semibold text-foreground">{roleDisplay.title}</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
              {roleDisplay.badge}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <RealtimeStatusBadge />
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto pb-20 md:pb-8 min-w-0">
          {isUnauthorized ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground font-medium">
                Redirecting to authorized dashboard...
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
