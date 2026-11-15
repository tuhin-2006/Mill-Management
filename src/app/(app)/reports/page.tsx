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
} from "@/lib/services";
import { formatBDT, getTodayInDhaka } from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import { DailyLedgerRow, MemberSummary } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ReportsPage() {
  const [ledgerRows, setLedgerRows] = React.useState<DailyLedgerRow[]>([]);
  const [memberSummaries, setMemberSummaries] = React.useState<MemberSummary[]>([]);

  // Filter range
  const today = getTodayInDhaka();
  // Default to this month: 1st of current month to today
  const firstDayOfMonth = today.slice(0, 8) + "01";
  const [startDate, setStartDate] = React.useState(firstDayOfMonth);
  const [endDate, setEndDate] = React.useState(today);

  React.useEffect(() => {
    async function fetchReportData() {
      try {
        const supabase = createClient();
        const [ledgerData, summaryData] = await Promise.all([
          getDailyLedger(supabase, startDate || undefined, endDate || undefined),
          getGroupSummary(supabase),
        ]);

        setLedgerRows(ledgerData);
        setMemberSummaries(summaryData.member_summaries);
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

  // Total deposits across all time
  const totalDeposits = memberSummaries.reduce((acc, m) => acc + m.total_deposited, 0);
  const totalNetBalance = totalDeposits - memberSummaries.reduce((acc, m) => acc + m.total_meal_cost, 0);

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMemberBalancesCSV}
              className="gap-2 text-xs"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Member Balances</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportFullCSV}
              className="gap-2 text-xs"
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
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="space-y-1 w-full sm:w-auto">
              <Label htmlFor="rep-start" className="text-xs">From Date</Label>
              <Input
                id="rep-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1 w-full sm:w-auto">
              <Label htmlFor="rep-end" className="text-xs">To Date</Label>
              <Input
                id="rep-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate(firstDayOfMonth);
                setEndDate(today);
              }}
              className="h-9 text-xs"
            >
              Reset to This Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Period Statistics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Total Meals
          </span>
          <p className="text-xl font-bold text-foreground mt-1">{totalMeals}</p>
        </div>
        <div className="p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Total Lunch
          </span>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {totalLunch}
          </p>
        </div>
        <div className="p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Total Dinner
          </span>
          <p className="text-xl font-bold text-indigo-500 mt-1">{totalDinner}</p>
        </div>
        <div className="p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Meal Expense
          </span>
          <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {formatBDT(totalMealExpense)}
          </p>
        </div>
        <div className="p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Total Deposits
          </span>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatBDT(totalDeposits)}
          </p>
        </div>
        <div className="p-4 bg-card rounded-xl border border-border">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Net Fund Balance
          </span>
          <p
            className={`text-xl font-bold mt-1 ${
              totalNetBalance >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive"
            }`}
          >
            {formatBDT(totalNetBalance)}
          </p>
        </div>
      </div>

      {/* Member Financial Totals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Member Financial Standing (All-Time Audit)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                  <tr key={m.id} className="hover:bg-muted/30">
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
        </CardContent>
      </Card>
    </div>
  );
}
