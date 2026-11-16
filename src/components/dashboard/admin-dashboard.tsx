"use client";

import * as React from "react";
import Link from "next/link";
import {
  UtensilsCrossed,
  Wallet,
  Users,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  PlusCircle,
  Sun,
  Moon,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDashboardData } from "@/lib/services";
import { formatBDT, formatFullDate, formatDate } from "@/lib/date";
import { Deposit, MealEntry, GroupSummary } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MigrationAlert } from "@/components/shared/migration-alert";
import { MemberBalanceTable } from "@/components/dashboard/member-balance-table";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

const AVATAR_COLORS = [
  "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface AdminDashboardProps {
  initialSummary: GroupSummary;
  initialRecentDeposits: Deposit[];
  initialTodayMeals: MealEntry[];
  isTableMissing?: boolean;
}

export function AdminDashboard({
  initialSummary,
  initialRecentDeposits,
  initialTodayMeals,
  isTableMissing = false,
}: AdminDashboardProps) {
  const [summary, setSummary] = React.useState<GroupSummary>(initialSummary);
  const [recentDeposits, setRecentDeposits] = React.useState<Deposit[]>(initialRecentDeposits);
  const [todayMeals, setTodayMeals] = React.useState<MealEntry[]>(initialTodayMeals);

  const refreshData = React.useCallback(async () => {
    try {
      const supabase = createClient();
      const data = await getDashboardData(supabase);
      setSummary(data.summary);
      setRecentDeposits(data.recentDeposits);
      setTodayMeals(data.todayMeals);
    } catch (err) {
      console.error("Failed to auto-refresh admin dashboard:", err);
    }
  }, []);

  // Real-time synchronization for manager dashboard
  useRealtimeSync(["meals", "deposits", "members", "settings", "all"], () => {
    void refreshData();
  });

  const isBalancePositive = summary.remaining_group_balance >= 0;
  const activePercent =
    summary.total_members_count > 0
      ? Math.round((summary.active_members_count / summary.total_members_count) * 100)
      : 0;

  const totalFinancialFlow = summary.total_group_deposit + summary.total_group_expense;
  const expenseRatio =
    totalFinancialFlow > 0
      ? Math.min(100, Math.round((summary.total_group_expense / summary.total_group_deposit) * 100))
      : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Welcome & Quick Actions Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 relative z-10">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="h-3 w-3" />
                <span>Mess Dashboard</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>System Active</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back, Manager 👋
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Today is {formatFullDate(summary.today_date)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <Link href="/meals">
              <Button size="sm" className="gap-2 shadow-xs text-xs sm:text-sm h-9">
                <PlusCircle className="h-4 w-4" />
                <span>Record Meal</span>
              </Button>
            </Link>
            <Link href="/deposits">
              <Button size="sm" variant="outline" className="gap-2 shadow-xs text-xs sm:text-sm h-9">
                <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Add Deposit</span>
              </Button>
            </Link>
            <Link href="/ledger">
              <Button size="sm" variant="ghost" className="gap-2 text-xs sm:text-sm h-9">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Total Ledger</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      </div>

      {/* Migration Alert */}
      <MigrationAlert isTableMissing={isTableMissing} />

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Treasury Balance */}
        <Card className="relative overflow-hidden border-border/80 shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Treasury Cash Balance
            </CardTitle>
            <div
              className={`p-2 rounded-xl ${
                isBalancePositive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {isBalancePositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span
                className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                  isBalancePositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {formatBDT(summary.remaining_group_balance)}
              </span>
              <Badge
                variant={isBalancePositive ? "default" : "destructive"}
                className="text-[10px] font-semibold"
              >
                {isBalancePositive ? "Surplus" : "Deficit"}
              </Badge>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Deposits: {formatBDT(summary.total_group_deposit)}</span>
              <span>Spent: {formatBDT(summary.total_group_expense)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Today's Meals */}
        <Card className="relative overflow-hidden border-border/80 shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Today&apos;s Meal Count
            </CardTitle>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {summary.today_total_meals}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                ≈ {formatBDT(summary.today_total_cost)}
              </span>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sun className="h-3 w-3 text-amber-500" />
                Lunch: {summary.today_lunch_count}
              </span>
              <span className="flex items-center gap-1">
                <Moon className="h-3 w-3 text-indigo-500" />
                Dinner: {summary.today_dinner_count}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Deposits Collected */}
        <Card className="relative overflow-hidden border-border/80 shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Deposits
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatBDT(summary.total_group_deposit)}
              </span>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Expenses: {formatBDT(summary.total_group_expense)}</span>
              <span className="text-emerald-600 font-medium">All-time</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Members */}
        <Card className="relative overflow-hidden border-border/80 shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Members
            </CardTitle>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {summary.active_members_count}
                <span className="text-sm font-normal text-muted-foreground">
                  /{summary.total_members_count}
                </span>
              </span>
              <Badge variant="outline" className="text-[10px] font-semibold">
                {activePercent}% active
              </Badge>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Managed members</span>
              <Link
                href="/members"
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                Manage <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Member Financial Status Breakdown Table */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold">
              Member Financial Balances
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live balances calculated from individual deposits minus meal expenses.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link href="/ledger">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <span>View Full Ledger</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <MemberBalanceTable memberSummaries={summary.member_summaries} />
        </CardContent>
      </Card>

      {/* Today's Meals & Recent Deposits Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Meal Details */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                <span>Today&apos;s Meal Participation</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(summary.today_date)} (
                {todayMeals.reduce((acc, m) => acc + m.quantity, 0)} meals recorded)
              </p>
            </div>
            <Link href="/meals">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                <span>Edit Today</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {todayMeals.length === 0 ? (
              <div className="py-8 text-center space-y-2.5">
                <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">
                  No meals have been recorded yet for today.
                </p>
                <Link href="/meals">
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    Record Meals Now
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {todayMeals.map((entry) => {
                  const memberName = entry.member?.name || "Member";
                  const avatarColor = getAvatarColor(memberName);
                  const initials = getInitials(memberName);

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/40 transition-colors text-xs gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-7 w-7 rounded-full border flex items-center justify-center font-bold text-[10px] shrink-0 ${avatarColor}`}
                        >
                          {initials}
                        </div>
                        <span className="font-semibold text-foreground truncate">
                          {memberName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="secondary"
                          className="text-[10px] uppercase font-semibold capitalize"
                        >
                          {entry.session}
                        </Badge>
                        <span className="font-bold text-foreground min-w-[32px] text-right">
                          {entry.quantity} {entry.quantity === 1 ? "meal" : "meals"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Deposits */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Recent Deposits</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Latest funds received into mess treasury
              </p>
            </div>
            <Link href="/deposits">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                <span>View All</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentDeposits.length === 0 ? (
              <div className="py-8 text-center space-y-2.5">
                <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                  <Wallet className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">
                  No deposit transactions recorded yet.
                </p>
                <Link href="/deposits">
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    Add First Deposit
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {recentDeposits.map((dep) => {
                  const memberName = dep.member?.name || "Member";
                  const avatarColor = getAvatarColor(memberName);
                  const initials = getInitials(memberName);

                  return (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/40 transition-colors text-xs gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-7 w-7 rounded-full border flex items-center justify-center font-bold text-[10px] shrink-0 ${avatarColor}`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground truncate block">
                            {memberName}
                          </span>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {formatDate(dep.deposit_date)} {dep.note && `• ${dep.note}`}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0 text-sm">
                        +{formatBDT(dep.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
