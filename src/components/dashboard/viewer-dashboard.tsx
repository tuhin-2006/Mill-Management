"use client";

import * as React from "react";
import {
  UtensilsCrossed,
  Wallet,
  Receipt,
  Download,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Filter,
  RotateCcw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT, formatDate, getPresetDateRange, DatePreset } from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import { createClient } from "@/lib/supabase/client";
import { getGroupAggregateLedger } from "@/lib/services";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { GroupAggregateReport } from "@/types";
import { toast } from "sonner";

interface ViewerDashboardProps {
  initialReport: GroupAggregateReport;
}

export function GroupLedgerViewerDashboard({ initialReport }: ViewerDashboardProps) {
  const [report, setReport] = React.useState<GroupAggregateReport>(initialReport);
  const [activePreset, setActivePreset] = React.useState<DatePreset | "custom">("all");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [isLoadingRange, setIsLoadingRange] = React.useState(false);

  const fetchAggregate = React.useCallback(async (start?: string, end?: string) => {
    try {
      setIsLoadingRange(true);
      const supabase = createClient();
      const res = await getGroupAggregateLedger(supabase, start || undefined, end || undefined);
      if (res) {
        setReport(res);
      }
    } catch (err: unknown) {
      toast.error("Failed to load aggregate report: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsLoadingRange(false);
    }
  }, []);

  // Real-time synchronization: automatically updates when group aggregate sync fires
  useRealtimeSync(["aggregate", "all"], () => {
    void fetchAggregate(startDate || undefined, endDate || undefined);
  });

  const handlePreset = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
      void fetchAggregate(undefined, undefined);
    } else {
      const range = getPresetDateRange(preset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      void fetchAggregate(range.startDate, range.endDate);
    }
  };

  const handleCustomStartDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset("custom");
    setStartDate(e.target.value);
    void fetchAggregate(e.target.value, endDate);
  };

  const handleCustomEndDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset("custom");
    setEndDate(e.target.value);
    void fetchAggregate(startDate, e.target.value);
  };

  const opening = report.opening;
  const period = report.period;
  const closing = report.closing;
  const lifetime = report.lifetime;
  const isPreviousDue = (opening?.balance ?? 0) < 0;
  const isClosingPositive = (closing?.balance ?? lifetime.balance) >= 0;

  // Export aggregate records to CSV
  const handleExportCSV = () => {
    try {
      const headers = [
        "Date",
        "Day",
        "Previous Bal (BDT)",
        "Lunch Count",
        "Dinner Count",
        "Total Meals",
        "Total Meal Cost (BDT)",
        "Collected Deposits (BDT)",
        "Running Bal (BDT)",
      ];
      const rows = report.daily_rows.map((r) => [
        r.meal_date,
        r.day_name,
        (r.previous_day_balance ?? 0).toString(),
        r.lunch_count.toString(),
        r.dinner_count.toString(),
        r.total_meals.toString(),
        r.total_cost.toString(),
        r.total_deposit.toString(),
        (r.running_balance ?? 0).toString(),
      ]);

      downloadCSV(`group_aggregate_ledger_audit`, headers, rows);
      toast.success("Aggregate group ledger exported to CSV.");
    } catch {
      toast.error("Failed to export aggregate CSV.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Group Ledger Viewer Portal
            </span>
            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
              Confidential Aggregate
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
            সম্মিলিত মেস খতিয়ান ও নিরীক্ষা বিবরণী
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Official group financial audit ledger. Strictly excludes individual member names and balances in compliance with privacy policy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5 text-xs h-9"
          >
            <Download className="h-4 w-4" />
            <span>Export Aggregate CSV</span>
          </Button>
        </div>
      </div>

      {/* Privacy Guarantee Notice (Strict Requirement) */}
      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 text-xs text-blue-800 dark:text-blue-300">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <p className="leading-relaxed">
          <strong>Privacy & Security Enforcement:</strong> This portal connects to dedicated backend aggregation functions. Individual identities, personal meal participation, and private member balances are cryptographically excluded from this view.
        </p>
      </div>

      {/* Date Filter & Presets Bar */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-none">
              <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1 shrink-0">
                <Filter className="h-3.5 w-3.5" />
                <span>Period:</span>
              </span>
              <button
                type="button"
                onClick={() => handlePreset("this_week")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                  activePreset === "this_week"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                This Week (এই সপ্তাহ)
              </button>
              <button
                type="button"
                onClick={() => handlePreset("this_month")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                  activePreset === "this_month"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                This Month (এই মাস)
              </button>
              <button
                type="button"
                onClick={() => handlePreset("last_month")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                  activePreset === "last_month"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                Last Month (গত মাস)
              </button>
              <button
                type="button"
                onClick={() => handlePreset("all")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                  activePreset === "all"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                All Time (সব রেকর্ড)
              </button>
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                {startDate
                  ? `${formatDate(startDate)} → ${endDate ? formatDate(endDate) : "Today"}`
                  : "All Records (Inception to Date)"}
              </span>
              {isLoadingRange && (
                <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin ml-1" />
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-border/60 flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[140px]">
              <Label htmlFor="v-start-date" className="text-[11px] font-semibold text-muted-foreground">
                From Date
              </Label>
              <Input
                id="v-start-date"
                type="date"
                value={startDate}
                onChange={handleCustomStartDate}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[140px]">
              <Label htmlFor="v-end-date" className="text-[11px] font-semibold text-muted-foreground">
                To Date
              </Label>
              <Input
                id="v-end-date"
                type="date"
                value={endDate}
                onChange={handleCustomEndDate}
                className="h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreset("all")}
                className="h-9 text-xs gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset to All</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 Financial Period Statement Cards (Identical to Admin Panel) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* 1. Previous Balance (Opening) */}
        <Card
          className={`border shadow-xs transition-all ${
            !startDate
              ? "border-border"
              : isPreviousDue
              ? "border-destructive/40 bg-gradient-to-br from-card via-card to-destructive/5"
              : "border-emerald-500/40 bg-gradient-to-br from-card via-card to-emerald-500/5"
          }`}
        >
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Previous Balance (পূর্ববর্তী ব্যালেন্স)
              </span>
              <Badge
                variant={!startDate ? "secondary" : isPreviousDue ? "destructive" : "success"}
                className="text-[10px] px-1.5 py-0"
              >
                {!startDate ? "Inception" : isPreviousDue ? "Previous Due" : "Advance B/F"}
              </Badge>
            </div>
            <div
              className={`text-xl sm:text-2xl font-extrabold truncate ${
                !startDate
                  ? "text-foreground"
                  : isPreviousDue
                  ? "text-destructive"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {!startDate ? "৳0" : formatBDT(opening?.balance ?? 0)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {!startDate
                ? "Starting from inception"
                : `Cost: ${formatBDT(opening?.total_cost ?? 0)} • Dep: ${formatBDT(
                    opening?.total_deposit ?? 0
                  )}`}
            </p>
          </CardContent>
        </Card>

        {/* 2. Period Meal Expense */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Period Meal Expense (মিল খরচ)
              </span>
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg shrink-0">
                <UtensilsCrossed className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-foreground truncate">
              {formatBDT(period.total_cost)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {period.total_meals} meals (Lunch: {period.total_lunch}, Dinner: {period.total_dinner})
            </p>
          </CardContent>
        </Card>

        {/* 3. Period Deposits */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Period Deposits (মোট জমা)
              </span>
              <div className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg shrink-0">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </div>
            <div
              className={`text-xl sm:text-2xl font-extrabold truncate ${
                period.total_deposit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              }`}
            >
              {period.total_deposit > 0 ? `+${formatBDT(period.total_deposit)}` : formatBDT(period.total_deposit)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Period net: {formatBDT(period.net_flow ?? (period.total_deposit - period.total_cost))} ({report.daily_payments?.length ?? 0} payment days)
            </p>
          </CardContent>
        </Card>

        {/* 4. Net Current Balance (Closing) */}
        <Card
          className={`border shadow-xs transition-all ${
            isClosingPositive
              ? "border-emerald-500/40 bg-gradient-to-br from-card via-card to-emerald-500/5"
              : "border-destructive/40 bg-gradient-to-br from-card via-card to-destructive/5"
          }`}
        >
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Closing Balance (বর্তমান ব্যালেন্স)
              </span>
              <Badge
                variant={isClosingPositive ? "success" : "destructive"}
                className="text-[10px] px-1.5 py-0"
              >
                {isClosingPositive ? "Surplus Fund" : "Net Due / Deficit"}
              </Badge>
            </div>
            <div
              className={`text-xl sm:text-2xl font-extrabold truncate ${
                isClosingPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {formatBDT(closing?.balance ?? lifetime.balance)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Previous Balance + Deposits - Meal Cost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Group Ledger Table (With Running Balance) */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                <span>সম্মিলিত দৈনিক মিলের খতিয়ান ও রানিং ব্যালেন্স (Daily Group Ledger & Running Balance)</span>
              </CardTitle>
              <CardDescription>
                প্রতিদিনের পূর্ববর্তী ব্যালেন্স, মিল খরচ, জমাকৃত টাকা এবং রানিং ব্যালেন্সের সমন্বিত হিসাব।
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs shrink-0 self-start sm:self-auto">
              {report.daily_rows.length} Days Recorded
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {report.daily_rows.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No ledger records found for this period.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Desktop & Tablet Table */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 px-3 font-semibold">Date & Day</th>
                      <th className="py-3 px-3 text-right font-semibold">Previous Bal (B/F)</th>
                      <th className="py-3 px-3 text-center font-semibold">Lunch</th>
                      <th className="py-3 px-3 text-center font-semibold">Dinner</th>
                      <th className="py-3 px-3 text-center font-semibold">Total Meals</th>
                      <th className="py-3 px-3 text-right font-semibold">Daily Meal Cost</th>
                      <th className="py-3 px-3 text-right font-semibold">Payments Received</th>
                      <th className="py-3 px-3 text-right font-semibold">Running Bal (C/F)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.daily_rows.map((row) => {
                      const prevBal = row.previous_day_balance ?? 0;
                      const runBal = row.running_balance ?? 0;

                      return (
                        <tr key={row.meal_date} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 font-medium text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{formatDate(row.meal_date)}</span>
                              <span className="text-[11px] text-muted-foreground">({row.day_name})</span>
                              {row.is_friday && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] border-amber-500/30 text-amber-700 dark:text-amber-400 py-0"
                                >
                                  Friday
                                </Badge>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right font-medium whitespace-nowrap">
                            <span
                              className={
                                prevBal >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }
                            >
                              {formatBDT(prevBal)}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center text-muted-foreground">
                            {row.lunch_count > 0 ? row.lunch_count : "-"}
                          </td>
                          <td className="py-3 px-3 text-center text-muted-foreground">
                            {row.is_friday ? (
                              <span className="text-[10px] text-muted-foreground/60 italic">Closed</span>
                            ) : row.dinner_count > 0 ? (
                              row.dinner_count
                            ) : (
                              "-"
                            )}
                          </td>

                          <td className="py-3 px-3 text-center font-bold text-foreground">
                            {row.total_meals}
                          </td>

                          <td className="py-3 px-3 text-right font-bold text-primary whitespace-nowrap">
                            -{formatBDT(row.total_cost)}
                          </td>

                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {row.total_deposit > 0 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                +{formatBDT(row.total_deposit)}
                              </span>
                            ) : row.total_deposit < 0 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                                {formatBDT(row.total_deposit)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">-</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-extrabold whitespace-nowrap">
                            <span
                              className={
                                runBal >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }
                            >
                              {formatBDT(runBal)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Phone Card View */}
              <div className="sm:hidden space-y-3">
                {report.daily_rows.map((row) => {
                  const prevBal = row.previous_day_balance ?? 0;
                  const runBal = row.running_balance ?? 0;

                  return (
                    <div
                      key={row.meal_date}
                      className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                          <span>{formatDate(row.meal_date)}</span>
                          <span className="text-[11px] font-normal text-muted-foreground">({row.day_name})</span>
                          {row.is_friday && (
                            <Badge
                              variant="outline"
                              className="text-[9px] border-amber-500/30 text-amber-700 dark:text-amber-400 py-0"
                            >
                              Friday
                            </Badge>
                          )}
                        </div>
                        <span
                          className={`font-extrabold text-sm ${
                            runBal >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          Bal: {formatBDT(runBal)}
                        </span>
                      </div>

                      {/* 3-Column Progression Bar */}
                      <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-muted/40 text-xs text-center border border-border/40">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Prev Balance</span>
                          <span
                            className={`font-semibold ${
                              prevBal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
                            }`}
                          >
                            {formatBDT(prevBal)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Day Meal Cost</span>
                          <span className="font-semibold text-primary">
                            -{formatBDT(row.total_cost)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Payments</span>
                          <span
                            className={`font-semibold ${
                              row.total_deposit > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : row.total_deposit < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {row.total_deposit > 0
                              ? `+${formatBDT(row.total_deposit)}`
                              : row.total_deposit < 0
                              ? formatBDT(row.total_deposit)
                              : "৳0"}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {row.total_meals} meals (Lunch: {row.lunch_count}, Dinner: {row.dinner_count})
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =========================================================================
          DEDICATED PAYMENT & DEPOSIT HISTORY (কবে কত টাকা জমা হয়েছে - Total Only)
          Strictly aggregate totals by date; excludes individual member identities
          ========================================================================= */}
      <Card className="border-border shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Payment & Deposit History (পেমেন্ট হিস্ট্রি - কবে টাকা জমা হয়েছে)</span>
            </CardTitle>
            <CardDescription>
              তারিখভিত্তিক সম্মিলিত মোট জমার নিরীক্ষা বিবরণী (গোপনীয়তা নীতিমালা অনুযায়ী সদস্যদের ব্যক্তিগত তথ্য গোপন রাখা হয়েছে)।
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs shrink-0">
              {report.daily_payments?.length || 0} Payment Days
            </Badge>
            <Badge
              variant="success"
              className="text-xs shrink-0 font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
            >
              Total Collected: +{formatBDT(report.period.total_deposit)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {!report.daily_payments || report.daily_payments.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30 text-emerald-600" />
              <p className="font-medium text-foreground">No payment records found for this period.</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                All deposits received will automatically organize here by date.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 px-3.5 font-semibold">Payment Date</th>
                      <th className="py-3 px-3.5 text-right font-semibold">Total Paid on Date (মোট জমা)</th>
                      <th className="py-3 px-3.5 font-semibold">Deposit Description (বিবরণ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.daily_payments.map((p) => (
                      <tr key={p.deposit_date} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-3.5 font-medium text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-bold text-xs">{formatDate(p.deposit_date)}</span>
                            <span className="text-[11px] text-muted-foreground">({p.day_name})</span>
                            {p.is_friday && (
                              <Badge
                                variant="outline"
                                className="text-[9px] border-amber-500/30 text-amber-700 dark:text-amber-400 py-0"
                              >
                                Friday
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-sm">
                            +{formatBDT(p.total_amount)}
                          </span>
                        </td>

                        <td className="py-3.5 px-3.5 text-muted-foreground text-xs">
                          সম্মিলিত মেস তহবিল জমা (Group Treasury Deposit)
                          {p.deposit_count && p.deposit_count > 1 ? ` • ${p.deposit_count} deposits received` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Phone Card View */}
              <div className="sm:hidden space-y-2.5">
                {report.daily_payments.map((p) => (
                  <div
                    key={p.deposit_date}
                    className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                        <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{formatDate(p.deposit_date)}</span>
                        <span className="text-[11px] font-normal text-muted-foreground">({p.day_name})</span>
                      </div>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md text-xs">
                        +{formatBDT(p.total_amount)}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      সম্মিলিত মেস তহবিল জমা (Group Deposit)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
