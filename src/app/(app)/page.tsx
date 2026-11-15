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
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGroupSummary, getDeposits, getMealsForDate } from "@/lib/services";
import { formatBDT, formatFullDate, formatDate } from "@/lib/date";
import { Deposit, MealEntry, GroupSummary } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MigrationAlert } from "@/components/shared/migration-alert";

export default async function DashboardPage() {
  const supabase = await createClient();

  let summary: GroupSummary;
  let recentDeposits: Deposit[] = [];
  let todayMeals: MealEntry[] = [];
  let isTableMissing = false;

  try {
    summary = await getGroupSummary(supabase);
    recentDeposits = (await getDeposits(supabase)).slice(0, 5);
    todayMeals = await getMealsForDate(supabase, summary.today_date);
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

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        title="Dashboard"
        description={`Today is ${formatFullDate(summary.today_date)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/meals">
              <Button variant="primary" size="sm" className="gap-1.5">
                <UtensilsCrossed className="h-4 w-4" />
                <span>Daily Meal Entry</span>
              </Button>
            </Link>
            <Link href="/deposits">
              <Button variant="outline" size="sm" className="gap-1.5">
                <PlusCircle className="h-4 w-4" />
                <span>Add Deposit</span>
              </Button>
            </Link>
          </div>
        }
      />

      {/* Migration Notice (If tables aren't yet executed in Supabase) */}
      <MigrationAlert isTableMissing={isTableMissing} />

      {/* 6 Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Today's Total Mill */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Today&apos;s Total Mill
            </CardTitle>
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {summary.today_total_meals} <span className="text-sm font-normal text-muted-foreground">meals</span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sun className="h-3 w-3 text-amber-500" /> Lunch: {summary.today_lunch_count}
              </span>
              <span className="flex items-center gap-1">
                <Moon className="h-3 w-3 text-indigo-400" /> Dinner: {summary.today_dinner_count}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Today's Total Cost */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Today&apos;s Total Cost
            </CardTitle>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatBDT(summary.today_total_cost)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Daily group consumption cost
            </p>
          </CardContent>
        </Card>

        {/* 3. Total Group Deposit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Group Deposit
            </CardTitle>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatBDT(summary.total_group_deposit)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total funds contributed by all members
            </p>
          </CardContent>
        </Card>

        {/* 4. Total Group Expense */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Group Expense
            </CardTitle>
            <div className="p-2 bg-rose-500/10 text-rose-600 rounded-lg">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {formatBDT(summary.total_group_expense)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Cumulative meal costs across all records
            </p>
          </CardContent>
        </Card>

        {/* 5. Remaining Group Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Remaining Group Balance
            </CardTitle>
            <div
              className={`p-2 rounded-lg ${
                isBalancePositive
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                isBalancePositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {formatBDT(summary.remaining_group_balance)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isBalancePositive ? "Surplus funds in fund" : "Group deficit / due"}
            </p>
          </CardContent>
        </Card>

        {/* 6. Total Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Members
            </CardTitle>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {summary.active_members_count}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {summary.total_members_count} total
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Configured mess members
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Individual Member Balance Overview Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Member Balances Overview
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Individual balances calculated from deposits minus consumed meal costs
            </p>
          </div>
          <Link href="/members">
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              <span>Manage Members</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Lunch</th>
                  <th className="py-3 px-4 text-center">Dinner</th>
                  <th className="py-3 px-4 text-center">Total Meals</th>
                  <th className="py-3 px-4 text-right">Meal Cost</th>
                  <th className="py-3 px-4 text-right">Deposited</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.member_summaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                      No members configured yet. Run the SQL migration or add members in the Members page.
                    </td>
                  </tr>
                ) : (
                  summary.member_summaries.map((m) => {
                    const isPositive = m.balance >= 0;
                    return (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">
                          {m.name}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={m.status === "active" ? "success" : "secondary"}>
                            {m.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">{m.total_lunch}</td>
                        <td className="py-3 px-4 text-center">{m.total_dinner}</td>
                        <td className="py-3 px-4 text-center font-semibold">
                          {m.total_meals}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">
                          {formatBDT(m.total_meal_cost)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatBDT(m.total_deposited)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            isPositive
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive"
                          }`}
                        >
                          {formatBDT(m.balance)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Grid: Recent Activity (Today's Meals & Recent Deposits) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Meals Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">Today&apos;s Meal Records</CardTitle>
            <Link href="/meals">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <span>Enter Meals</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {todayMeals.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No meals recorded yet for today ({formatDate(summary.today_date)}).
              </p>
            ) : (
              <div className="space-y-2">
                {todayMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {meal.member?.name || "Member"}
                      </span>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {meal.session}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{meal.quantity ? "1 meal" : "0 meal"}</span>
                      <span className="font-medium text-foreground">
                        {formatBDT(meal.quantity * meal.unit_price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Deposits Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">Recent Deposits</CardTitle>
            <Link href="/deposits">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <span>View All</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentDeposits.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No deposit transactions recorded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {recentDeposits.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground">
                        {dep.member?.name || "Member"}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(dep.deposit_date)} {dep.note && `• ${dep.note}`}
                      </p>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatBDT(dep.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
