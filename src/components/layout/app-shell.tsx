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
} from "lucide-react";
import { navigationConfig } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
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
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
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
      <div className="md:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open mobile menu"
            className="text-foreground"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Wheat className="h-5 w-5" />
            <span className="text-foreground truncate">{siteConfig.name}</span>
          </div>
        </div>

        <ThemeToggle />
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div className="relative w-72 max-w-[85vw] flex flex-col bg-card border-r border-border p-6 shadow-xl z-10">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Wheat className="h-5 w-5" />
                <span className="text-foreground">{siteConfig.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close mobile menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="mt-4 flex-1 space-y-1 overflow-y-auto">
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
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Appearance</span>
                <ThemeToggle />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                isLoading={isLoggingOut}
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive justify-start gap-2 text-xs"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-200",
          isCollapsed ? "md:pl-20" : "md:pl-64"
        )}
      >
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 items-center justify-between px-8 border-b border-border bg-card/60 backdrop-blur-xs sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Admin Private Session</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
