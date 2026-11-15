"use client";

import * as React from "react";
import {
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getDailyLedger,
  getGroupSummary,
  getCurrentUserProfile,
  getGroupAggregateLedger,
} from "@/lib/services";
import { formatBDT, getTodayInDhaka } from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import { DailyLedgerRow, MemberSummary, UserRole } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ReportsPage() {
  const [userRole, setUserRole] = React.useState<UserRole>("admin");
  const [ledgerRows, setLedgerRows] = React.useState<DailyLedgerRow[]>([]);
  const [memberSummaries, setMemberSummaries] = React.useState<MemberSummary[]>([]);
  const [groupLifetimeDeposits, setGroupLifetimeDeposits] = React.useState(0);
  const [groupLifetimeExpenses, setGroupLifetimeExpenses] = React.useState(0);

  // Filter range
  const today = getTodayInDhaka();
  const firstDayOfMonth = today.slice(0, 8) + "01";
  const [startDate, setStartDate] = React.useState(firstDayOfMonth);
  const [endDate, setEndDate] = React.useState(today);

  React.useEffect(() => {
    async function fetchReportData() {
      try {
        const supabase = createClient();
        const profile = await getCurrentUserProfile(supabase);
        const role = profile?.role || "admin";
        setUserRole(role);

        if (role === "group_ledger_viewer") {
          // Strictly aggregate-only query for Group Ledger Viewer
          const agg = await getGroupAggregateLedger(supabase, startDate || undefined, endDate || undefined);
          const mappedRows: DailyLedgerRow[] = agg.daily_rows.map((r) => ({
            meal_date: r.meal_date,
            day_name: r.day_name,
            is_friday: r.is_friday,
            lunch_count: r.lunch_count,
            dinner_count: r.dinner_count,
            total_meals: r.total_meals,
            total_cost: r.total_cost,
            active_members_ate: 0,
          }));
          setLedgerRows(mappedRows);
          setGroupLifetimeDeposits(agg.lifetime.total_deposits);
          setGroupLifetimeExpenses(agg.lifetime.total_expenses);
        } else {
          const [ledgerData, summaryData] = await Promise.all([
            getDailyLedger(supabase, startDate || undefined, endDate || undefined),
            getGroupSummary(supabase),
          ]);

          setLedgerRows(ledgerData);
          setMemberSummaries(summaryData.member_summaries);
          setGroupLifetimeDeposits(summaryData.total_group_deposit);
          setGroupLifetimeExpenses(summaryData.total_group_expense);
        }
      } catch (err: unknown) {
        toast.error("Failed to load report data: " + (err instanceof Error ? err.message : ""));
      }
    }

    fetchReportData();
  }, [startDate, endDate]);

  // Calculations for filtered range
  const totalMeals = ledgerRows.reduce((acc, r) => acc + r.total_meals, 0);
  const totalLunch = ledgerRows.reduce((acc, r) => acc + r.lunch_count, 0);
  const totalDinner = ledgerRows.reduce((acc, r) => acc + r.dinner_count, 0);
  const totalMealExpense = ledgerRows.reduce((acc, r) => acc + r.total_cost, 0);

  // Group balance
  const totalDeposits = groupLifetimeDeposits;
  const totalNetBalance = groupLifetimeDeposits - groupLifetimeExpenses;

  // Export Complete Report CSV
  const handleExportFullCSV = () => {
    if (ledgerRows.length === 0) {
      toast.info("No records to export for this period.");
      return;
    }

    const mealHeaders = [
      "Date",
      "Weekday",
      "Friday",
      "Lunch Meals",
      "Dinner Meals",
      "Total Meals",
      "Cost (BDT)",
    ];

    const mealRows = ledgerRows.map((r) => [
      r.meal_date,
      r.day_name,
      r.is_friday ? "Yes" : "No",
      r.lunch_count,
      r.dinner_count,
      r.total_meals,
      r.total_cost,
    ]);

    downloadCSV(`mill-report-${startDate}-to-${endDate}`, mealHeaders, mealRows);
    toast.success("Report CSV downloaded.");
  };

  // Export Member Balances CSV
  const handleExportMemberBalancesCSV = () => {
    if (memberSummaries.length === 0) {
      toast.info("No member data to export.");
      return;
    }

    const headers = [
      "Member Name",
      "Status",
      "Total Meals",
      "Total Lunch",
      "Total Dinner",
      "Total Meal Cost (BDT)",
      "Total Deposited (BDT)",
      "Current Balance (BDT)",
    ];

    const rows = memberSummaries.map((m) => [
      m.name,
      m.status,
      m.total_meals,
      m.total_lunch,
      m.total_dinner,
      m.total_meal_cost,
      m.total_deposited,
      m.balance,
    ]);

    downloadCSV("member-financial-summaries", headers, rows);
    toast.success("Member summaries CSV downloaded.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="History & Reports"
        description="Comprehensive expense analysis, monthly statistics, and audit reports."
        actions={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {userRole === "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMemberBalancesCSV}
                className="gap-2 text-xs flex-1 sm:flex-initial h-9"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export Member Balances</span>
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportFullCSV}
              className="gap-2 text-xs flex-1 sm:flex-initial h-9"
            >
              <Download className="h-4 w-4" />
              <span>Export Period Meals</span>
            </Button>
          </div>
        }
      />

      {/* Date Filter Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="space-y-1 flex-1 sm:flex-initial">
              <Label htmlFor="rep-start" className="text-xs">From Date</Label>
              <Input
                id="rep-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs w-full sm:w-auto"
              />
            </div>
            <div className="space-y-1 flex-1 sm:flex-initial">
              <Label htmlFor="rep-end" className="text-xs">To Date</Label>
              <Input
                id="rep-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs w-full sm:w-auto"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate(firstDayOfMonth);
                setEndDate(today);
              }}
              className="h-9 text-xs w-full sm:w-auto"
            >
              Reset to This Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Period Statistics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <div className="p-3.5 sm:p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground truncate block">
            Total Meals
          </span>
          <p className="text-lg sm:text-xl font-bold text-foreground mt-1 truncate">{totalMeals}</p>
        </div>
        <div className="p-3.5 sm:p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground truncate block">
            Total Lunch
          </span>
          <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 truncate">
            {totalLunch}
          </p>
        </div>
        <div className="p-3.5 sm:p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground truncate block">
            Total Dinner
          </span>
          <p className="text-lg sm:text-xl font-bold text-indigo-500 mt-1 truncate">{totalDinner}</p>
        </div>
        <div className="p-3.5 sm:p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground truncate block">
            Meal Expense
          </span>
          <p className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 truncate">
            {formatBDT(totalMealExpense)}
          </p>
        </div>
        <div className="p-3.5 sm:p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground truncate block">
            Total Deposits
          </span>
          <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {formatBDT(totalDeposits)}
          </p>
        </div>
        <div className="p-3.5 sm:p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground truncate block">
            Net Balance
          </span>
          <p
            className={`text-lg sm:text-xl font-bold mt-1 truncate ${
              totalNetBalance >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive"
            }`}
          >
            {formatBDT(totalNetBalance)}
          </p>
        </div>
      </div>

      {/* Member Financial Totals Table (Admin Only) */}
      {userRole === "admin" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Member Financial Standing (All-Time Audit)</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4 text-center">Meals Eaten</th>
                    <th className="py-3 px-4 text-right">Total Meal Cost</th>
                    <th className="py-3 px-4 text-right">Total Deposited</th>
                    <th className="py-3 px-4 text-right">Current Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {memberSummaries.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">{m.name}</td>
                      <td className="py-3 px-4 text-center font-medium">{m.total_meals}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        {formatBDT(m.total_meal_cost)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {formatBDT(m.total_deposited)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold ${
                          m.balance >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                        }`}
                      >
                        {formatBDT(m.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Phone Cards View */}
            <div className="md:hidden space-y-2.5">
              {memberSummaries.map((m) => {
                const isPositive = m.balance >= 0;
                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl border border-border bg-card/60 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-sm">{m.name}</span>
                      <span
                        className={`text-sm font-bold ${
                          isPositive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                        }`}
                      >
                        {formatBDT(m.balance)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-muted/40 text-xs text-center border border-border/40">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Meals</span>
                        <span className="font-semibold text-foreground">{m.total_meals}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Cost</span>
                        <span className="font-semibold text-muted-foreground">{formatBDT(m.total_meal_cost)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Deposited</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatBDT(m.total_deposited)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aggregate Daily Table (Viewer & Admin) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Daily Meal Ledger Audit (Period Log)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase text-[10px] font-semibold">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Day</th>
                  <th className="py-2.5 px-3 text-center">Lunch</th>
                  <th className="py-2.5 px-3 text-center">Dinner</th>
                  <th className="py-2.5 px-3 text-center">Total Meals</th>
                  <th className="py-2.5 px-3 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ledgerRows.map((r) => (
                  <tr key={r.meal_date} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-foreground">{r.meal_date}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{r.day_name}</td>
                    <td className="py-2.5 px-3 text-center">{r.lunch_count}</td>
                    <td className="py-2.5 px-3 text-center">{r.dinner_count}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-foreground">{r.total_meals}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-foreground">{formatBDT(r.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
