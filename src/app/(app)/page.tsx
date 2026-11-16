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
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import {
  getDashboardData,
  getCurrentUserProfile,
  getMemberPersonalStatement,
  getGroupAggregateLedger,
} from "@/lib/services";
import { formatBDT, formatFullDate, formatDate } from "@/lib/date";
import { Deposit, MealEntry, GroupSummary } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MigrationAlert } from "@/components/shared/migration-alert";
import { MemberBalanceTable } from "@/components/dashboard/member-balance-table";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";
import { GroupLedgerViewerDashboard } from "@/components/dashboard/viewer-dashboard";

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

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  // Role-Based Dashboard Resolution (resolved with 0 duplicate network calls)
  const profile = await getCurrentUserProfile(supabase, user);

  if (profile?.role === "member") {
    let statement = null;
    if (profile.member_id) {
      statement = await getMemberPersonalStatement(supabase, profile.member_id);
    }
    if (statement) {
      return <MemberDashboard initialData={statement} />;
    }
  }

  if (profile?.role === "group_ledger_viewer") {
    const aggregateReport = await getGroupAggregateLedger(supabase);
    return <GroupLedgerViewerDashboard initialReport={aggregateReport} />;
  }

  let summary: GroupSummary;
  let recentDeposits: Deposit[] = [];
  let todayMeals: MealEntry[] = [];
  let isTableMissing = false;

  try {
    const data = await getDashboardData(supabase);
    summary = data.summary;
    recentDeposits = data.recentDeposits;
    todayMeals = data.todayMeals;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("does not exist") || msg.includes("PGRST205") || msg.includes("schema cache")) {
      isTableMissing = true;
    }
    summary = {
      today_date: new Date().toISOString().split("T")[0],
      today_total_meals: 0,
      today_total_cost: 0,
      today_lunch_count: 0,
      today_dinner_count: 0,
      total_group_deposit: 0,
      total_group_expense: 0,
      remaining_group_balance: 0,
      active_members_count: 0,
      total_members_count: 0,
      member_summaries: [],
    };
  }

  const isBalancePositive = summary.remaining_group_balance >= 0;
  const activePercent =
    summary.total_members_count > 0
      ? Math.round((summary.active_members_count / summary.total_members_count) * 100)
      : 0;

  // Expense ratio for balance indicator bar
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

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link href="/meals" className="flex-1 sm:flex-initial">
              <Button
                variant="primary"
                size="sm"
                className="w-full sm:w-auto gap-2 h-10 px-4 shadow-sm hover:shadow transition-all"
              >
                <UtensilsCrossed className="h-4 w-4" />
                <span className="font-semibold">Daily Meal Entry</span>
              </Button>
            </Link>
            <Link href="/deposits" className="flex-1 sm:flex-initial">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto gap-2 h-10 px-4 hover:bg-muted/80 transition-all"
              >
                <PlusCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Add Deposit</span>
              </Button>
            </Link>
            <Link href="/reports" className="hidden sm:inline-flex">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-10 px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                <FileText className="h-4 w-4" />
                <span>Reports</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Migration Notice (If tables aren't yet executed in Supabase) */}
      <MigrationAlert isTableMissing={isTableMissing} />

      {/* 6 Key Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {/* 1. HERO KPI: Remaining Group Fund Balance */}
        <Card
          className={`relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            isBalancePositive
              ? "border-emerald-500/40 bg-gradient-to-br from-card via-card to-emerald-500/5"
              : "border-destructive/40 bg-gradient-to-br from-card via-card to-destructive/5"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Remaining Group Balance
              </CardTitle>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                  isBalancePositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {isBalancePositive ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Surplus Fund
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3" /> Group Deficit / Due
                  </>
                )}
              </span>
            </div>
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isBalancePositive
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              <Wallet className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl sm:text-3xl font-extrabold truncate tracking-tight ${
                isBalancePositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {formatBDT(summary.remaining_group_balance)}
            </div>

            {/* Mini visual ratio meter */}
            <div className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Deposited: {formatBDT(summary.total_group_deposit)}</span>
              <span>Spent: {expenseRatio}%</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Today's Total Meals */}
        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Today&apos;s Total Mill
            </CardTitle>
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground truncate tracking-tight">
              {summary.today_total_meals}{" "}
              <span className="text-xs sm:text-sm font-normal text-muted-foreground">meals</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-2.5 text-xs text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Sun className="h-3.5 w-3.5 text-amber-500" /> Lunch: {summary.today_lunch_count}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Moon className="h-3.5 w-3.5 text-indigo-400" /> Dinner: {summary.today_dinner_count}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Today's Total Cost */}
        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-amber-500/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Today&apos;s Total Cost
            </CardTitle>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl shrink-0">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground truncate tracking-tight">
              {formatBDT(summary.today_total_cost)}
            </div>
            <p className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground truncate">
              {summary.today_total_meals > 0
                ? `Avg ${formatBDT(Math.round(summary.today_total_cost / summary.today_total_meals))} per meal`
                : "No meal consumption recorded yet today"}
            </p>
          </CardContent>
        </Card>

        {/* 4. Total Group Deposit */}
        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-500/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Group Deposit
            </CardTitle>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 truncate tracking-tight">
              {formatBDT(summary.total_group_deposit)}
            </div>
            <p className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground truncate">
              Total collective funds received
            </p>
          </CardContent>
        </Card>

        {/* 5. Total Group Expense */}
        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-rose-500/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Group Expense
            </CardTitle>
            <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 truncate tracking-tight">
              {formatBDT(summary.total_group_expense)}
            </div>
            <p className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground truncate">
              Cumulative meal food charges
            </p>
          </CardContent>
        </Card>

        {/* 6. Active Members */}
        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Members
            </CardTitle>
            <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground truncate tracking-tight">
              {summary.active_members_count}{" "}
              <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                / {summary.total_members_count} total
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Participation</span>
              <span className="font-semibold text-foreground">{activePercent}% active</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Member Balances Overview (Searchable & Filterable Table) */}
      <Card className="border-border shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold">
              Member Balances Overview
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Individual balances calculated from member deposits minus consumed meal costs
            </p>
          </div>
          <Link href="/members" className="self-start sm:self-auto">
            <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
              <span>Manage Members</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="pt-4">
          {summary.member_summaries.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No members configured yet. Add members in the Members page to start tracking meals.
            </div>
          ) : (
            <MemberBalanceTable memberSummaries={summary.member_summaries} />
          )}
        </CardContent>
      </Card>

      {/* Bottom Grid: Recent Activity (Today's Meals & Recent Deposits) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Today's Meals Card */}
        <Card className="border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm sm:text-base font-bold">
                Today&apos;s Meal Records
              </CardTitle>
              {todayMeals.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0">
                  {todayMeals.length} records
                </Badge>
              )}
            </div>
            <Link href="/meals">
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-8 text-primary hover:text-primary/80">
                <span>Enter Meals</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {todayMeals.length === 0 ? (
              <div className="py-8 text-center space-y-2.5">
                <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">
                  No meals recorded yet for today ({formatDate(summary.today_date)}).
                </p>
                <Link href="/meals">
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    Record Today&apos;s Meals
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {todayMeals.map((meal) => {
                  const memberName = meal.member?.name || "Member";
                  const avatarColor = getAvatarColor(memberName);
                  const initials = getInitials(memberName);

                  return (
                    <div
                      key={meal.id}
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
                          <span className="text-[11px] text-muted-foreground capitalize flex items-center gap-1">
                            {meal.session === "lunch" ? (
                              <Sun className="h-3 w-3 text-amber-500" />
                            ) : (
                              <Moon className="h-3 w-3 text-indigo-400" />
                            )}
                            {meal.session} • {meal.quantity ? "1 meal" : "0 meal"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-foreground">
                          {formatBDT(meal.quantity * meal.unit_price)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Deposits Card */}
        <Card className="border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm sm:text-base font-bold">
                Recent Deposits
              </CardTitle>
              {recentDeposits.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0">
                  Last {recentDeposits.length}
                </Badge>
              )}
            </div>
            <Link href="/deposits">
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-8 text-primary hover:text-primary/80">
                <span>View All</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
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
