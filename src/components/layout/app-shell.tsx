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
import { navigationConfig } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { invalidateCache } from "@/lib/services";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  // Automatic logout on inactivity (15 mins with 1 min advance alert)
  useInactivityLogout();

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
                  Personal Mill
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigationConfig.map((item) => {
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

        <div className="flex items-center gap-1 sm:gap-2">
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
                  <span className="text-[10px] text-muted-foreground uppercase font-medium">Personal Mess</span>
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
              {navigationConfig.map((item) => {
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
                <span>Logout Admin Session</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Thumb Friendly) */}
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

        <Link
          href="/meals"
          className={cn(
            "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
            pathname === "/meals"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <UtensilsCrossed className="h-4.5 w-4.5 mb-0.5" />
          <span>Meals</span>
        </Link>

        <Link
          href="/deposits"
          className={cn(
            "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
            pathname === "/deposits"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Wallet className="h-4.5 w-4.5 mb-0.5" />
          <span>Deposits</span>
        </Link>

        <Link
          href="/members"
          className={cn(
            "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors",
            pathname === "/members"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-4.5 w-4.5 mb-0.5" />
          <span>Members</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors cursor-pointer",
            pathname === "/ledger" || pathname === "/reports" || pathname === "/settings"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MoreHorizontal className="h-4.5 w-4.5 mb-0.5" />
          <span>More</span>
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
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">Admin Private Session</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto pb-20 md:pb-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
