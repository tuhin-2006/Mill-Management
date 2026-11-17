"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  Calendar,
  Filter,
  RotateCcw,
  Download,
  Wallet,
  TrendingUp,
  Receipt,
  CreditCard,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile, getPeriodLedgerReport, getCachedItem } from "@/lib/services";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatDate,
  formatFullDate,
  formatDateTime,
  formatBDT,
  getPresetDateRange,
  getWeekdayName,
  isFridayDate,
  DatePreset,
} from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import { PeriodLedgerReport, DateGroupedPayment, PeriodPaymentRecord } from "@/types";
import { toast } from "sonner";

export default function MyMealsPage() {
  const router = useRouter();
  const [report, setReport] = React.useState<PeriodLedgerReport | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [memberId, setMemberId] = React.useState<string | null>(null);
  const [paymentSearch, setPaymentSearch] = React.useState("");
  const [paymentViewMode, setPaymentViewMode] = React.useState<"grouped" | "individual">("grouped");

  const [activePreset, setActivePreset] = React.useState<DatePreset | "custom">("this_month");
  const defaultRange = React.useMemo(() => getPresetDateRange("this_month"), []);
  const [startDate, setStartDate] = React.useState(defaultRange.startDate);
  const [endDate, setEndDate] = React.useState(defaultRange.endDate);

  // Initial user check
  React.useEffect(() => {
    async function initUser() {
      const supabase = createClient();
      const profile = await getCurrentUserProfile(supabase);
      if (!profile || profile.role !== "member" || !profile.member_id) {
        router.replace("/");
        return;
      }
      setMemberId(profile.member_id);
    }
    void initUser();
  }, [router]);

  const loadData = React.useCallback(async (showLoading = true) => {
    if (!memberId) return;
    try {
      if (showLoading) {
        const cacheKey = `period_ledger:${startDate || "all"}:${endDate || "all"}:${memberId}`;
        const cached = getCachedItem<PeriodLedgerReport>(cacheKey);
        if (cached) {
          setReport(cached);
        } else {
          setIsLoading(true);
        }
      }
      const supabase = createClient();
      const res = await getPeriodLedgerReport(
        supabase,
        startDate || undefined,
        endDate || undefined,
        memberId
      );
      setReport(res);
    } catch (err: unknown) {
      toast.error("Failed to load meal ledger: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsLoading(false);
    }
  }, [memberId, startDate, endDate]);

  // Fetch data on range change
  React.useEffect(() => {
    void loadData(true);
  }, [loadData]);

  // Real-time synchronization for member meals and deposits
  useRealtimeSync(["meals", "deposits", "all"], () => {
    void loadData(false);
  });

  const handlePreset = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else {
      const range = getPresetDateRange(preset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  const handleCustomStartDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset("custom");
    setStartDate(e.target.value);
  };

  const handleCustomEndDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset("custom");
    setEndDate(e.target.value);
  };

  const handleExportCSV = () => {
    if (!report || report.dailyRows.length === 0) {
      toast.info("No meal records to export.");
      return;
    }
    const headers = [
      "Date",
      "Day",
      "Previous Bal (BDT)",
      "Lunch Meals",
      "Dinner Meals",
      "Total Meals",
      "Daily Cost (BDT)",
      "Payments Received (BDT)",
      "Running Bal (BDT)",
    ];
    const rows = report.dailyRows.map((r) => [
      r.meal_date,
      r.day_name,
      (r.previous_day_balance ?? 0).toString(),
      r.lunch_count.toString(),
      r.dinner_count.toString(),
      r.total_meals.toString(),
      r.total_cost.toString(),
      (r.daily_deposit ?? 0).toString(),
      (r.running_balance ?? 0).toString(),
    ]);
    downloadCSV(`my_meal_ledger_${startDate || "all"}_to_${endDate || "current"}`, headers, rows);
    toast.success("Meal ledger exported to CSV.");
  };

  const isPreviousDue = (report?.opening.balance ?? 0) < 0;
  const isClosingPositive = (report?.closing.balance ?? 0) >= 0;

  // Filtered Payments
  const filteredPayments = React.useMemo(() => {
    const list = report?.paymentTransactions || [];
    if (!paymentSearch.trim()) return list;
    const q = paymentSearch.toLowerCase();
    return list.filter(
      (p) =>
        (p.note && p.note.toLowerCase().includes(q)) ||
        p.deposit_date.includes(q)
    );
  }, [report?.paymentTransactions, paymentSearch]);

  // Date-wise Aggregated Payments
  const filteredDateGroupedPayments: DateGroupedPayment[] = React.useMemo(() => {
    const map = new Map<string, { total_amount: number; payments: PeriodPaymentRecord[] }>();
    for (const p of filteredPayments) {
      const existing = map.get(p.deposit_date) || { total_amount: 0, payments: [] };
      existing.total_amount += p.amount;
      existing.payments.push(p);
      map.set(p.deposit_date, existing);
    }
    return Array.from(map.entries())
      .map(([date, grp]) => ({
        deposit_date: date,
        day_name: getWeekdayName(date),
        is_friday: isFridayDate(date),
        total_amount: grp.total_amount,
        payment_count: grp.payments.length,
        payments: grp.payments,
      }))
      .sort((a, b) => b.deposit_date.localeCompare(a.deposit_date));
  }, [filteredPayments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Meal Ledger & Running Balance"
        description="Detailed record of daily lunch & dinner meals, running balance progression, and payment history"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5 text-xs h-9"
          >
            <Download className="h-4 w-4" />
            <span>Export Ledger CSV</span>
          </Button>
        }
      />

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
            </div>
          </div>

          <div className="pt-2 border-t border-border/60 flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[140px]">
              <Label htmlFor="m-start-date" className="text-[11px] font-semibold text-muted-foreground">
                From Date
              </Label>
              <Input
                id="m-start-date"
                type="date"
                value={startDate}
                onChange={handleCustomStartDate}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[140px]">
              <Label htmlFor="m-end-date" className="text-[11px] font-semibold text-muted-foreground">
                To Date
              </Label>
              <Input
                id="m-end-date"
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

      {/* 4 Financial Period Statement Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* 1. Previous Balance (Opening) */}
        <Card
          className={`border shadow-xs transition-all ${
            isPreviousDue
              ? "border-destructive/40 bg-gradient-to-br from-card via-card to-destructive/5"
              : (report?.opening.balance ?? 0) > 0
              ? "border-emerald-500/40 bg-gradient-to-br from-card via-card to-emerald-500/5"
              : "border-border"
          }`}
        >
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Previous Balance
              </span>
              <Badge
                variant={isPreviousDue ? "destructive" : (report?.opening.balance ?? 0) > 0 ? "success" : "secondary"}
                className="text-[10px] px-1.5 py-0"
              >
                {isPreviousDue
                  ? "Previous Due"
                  : (report?.opening.balance ?? 0) > 0
                  ? "Advance B/F"
                  : "Inception"}
              </Badge>
            </div>
            <div
              className={`text-xl sm:text-2xl font-extrabold truncate ${
                isPreviousDue
                  ? "text-destructive"
                  : (report?.opening.balance ?? 0) > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
              }`}
            >
              {formatBDT(report?.opening.balance ?? 0)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {!startDate
                ? "Starting balance / Previous due"
                : `Cost: ${formatBDT(report?.opening.total_cost ?? 0)} • Dep: ${formatBDT(
                    report?.opening.total_deposit ?? 0
                  )}`}
            </p>
          </CardContent>
        </Card>

        {/* 2. Period Meal Expense */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Period Meal Expense
              </span>
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg shrink-0">
                <UtensilsCrossed className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-foreground truncate">
              {formatBDT(report?.period.total_cost ?? 0)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {report?.period.total_meals ?? 0} meals (Lunch: {report?.period.lunch_count ?? 0}, Dinner:{" "}
              {report?.period.dinner_count ?? 0})
            </p>
          </CardContent>
        </Card>

        {/* 3. Period Deposits */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Period Deposits
              </span>
              <div className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg shrink-0">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 truncate">
              {(report?.period.total_deposit ?? 0) > 0
                ? `+${formatBDT(report?.period.total_deposit ?? 0)}`
                : formatBDT(report?.period.total_deposit ?? 0)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Period net: {formatBDT(report?.period.net_flow ?? 0)} ({report?.paymentTransactions?.length ?? 0} deposits)
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
                Closing Balance
              </span>
              <Badge
                variant={isClosingPositive ? "success" : "destructive"}
                className="text-[10px] px-1.5 py-0"
              >
                {isClosingPositive ? "Advance / জমা" : "Due / বকেয়া"}
              </Badge>
            </div>
            <div
              className={`text-xl sm:text-2xl font-extrabold truncate ${
                isClosingPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {formatBDT(report?.closing.balance ?? 0)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Previous Balance + Deposits - Meal Cost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table: Daily Session Consumption & Running Balance */}
      <Card className="border-border shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              <span>Daily Session Consumption & Running Balance</span>
            </CardTitle>
            <CardDescription>
              Shows each day&apos;s previous balance, meal cost added, payments received, and updated running balance.
            </CardDescription>
          </div>
          {report && (
            <Badge variant="outline" className="text-xs self-start sm:self-auto">
              {report.dailyRows.length} Days Recorded
            </Badge>
          )}
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading daily running ledger...</span>
            </div>
          ) : !report || report.dailyRows.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No daily meal entries found in this selected period.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-border bg-card">
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
                    {report.dailyRows.map((row) => {
                      const hasDeposits = (row.daily_deposit ?? 0) > 0;
                      const prevBal = row.previous_day_balance ?? 0;
                      const runBal = row.running_balance ?? 0;

                      return (
                        <tr key={row.meal_date} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 font-medium text-foreground">
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

                          <td className="py-3 px-3 text-right font-medium">
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

                          <td className="py-3 px-3 text-right font-bold text-primary">
                            -{formatBDT(row.total_cost)}
                          </td>

                          <td className="py-3 px-3 text-right">
                            {hasDeposits ? (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                +{formatBDT(row.daily_deposit!)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">-</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-extrabold">
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
              <div className="lg:hidden space-y-3">
                {report.dailyRows.map((row) => {
                  const prevBal = row.previous_day_balance ?? 0;
                  const runBal = row.running_balance ?? 0;
                  const hasDeposits = (row.daily_deposit ?? 0) > 0;

                  return (
                    <div
                      key={row.meal_date}
                      className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm">
                            {formatDate(row.meal_date)}
                          </span>
                          <span className="text-xs text-muted-foreground">({row.day_name})</span>
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

                      {/* Balance Progression Bar */}
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
                              hasDeposits
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {hasDeposits ? `+${formatBDT(row.daily_deposit!)}` : "৳0"}
                          </span>
                        </div>
                      </div>

                      {/* Meals Stats */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {row.total_meals} meals (Lunch: {row.lunch_count}, Dinner: {row.dinner_count})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dedicated Section Below: Payment & Deposit Records (কবে payment করা হয়েছে) */}
      <Card className="border-border shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>My Payment & Deposit Records (কবে টাকা জমা দিয়েছি)</span>
            </CardTitle>
            <CardDescription>
              Chronological log of all deposits recorded to your account, organized by payment date.
            </CardDescription>
          </div>

          {/* Payment Search, Mode Switcher & Count */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search note or date..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="h-8 pl-8 text-xs w-[160px] sm:w-[190px]"
              />
            </div>

            {/* View Mode Toggle: Date-Wise Grouped vs Individual Transactions */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-muted border border-border text-xs shrink-0">
              <button
                type="button"
                onClick={() => setPaymentViewMode("grouped")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  paymentViewMode === "grouped"
                    ? "bg-card text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Group deposits by date and sum daily totals"
              >
                তারিখ অনুযায়ী মোট
              </button>
              <button
                type="button"
                onClick={() => setPaymentViewMode("individual")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  paymentViewMode === "individual"
                    ? "bg-card text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="View individual transaction line items"
              >
                একক তালিকা
              </button>
            </div>

            <Badge variant="outline" className="text-xs shrink-0">
              {paymentViewMode === "grouped"
                ? `${filteredDateGroupedPayments.length} Payment Days`
                : `${filteredPayments.length} Payments`}
            </Badge>
            <Badge
              variant="success"
              className="text-xs shrink-0 font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
            >
              Total: +{formatBDT(filteredPayments.reduce((acc, p) => acc + p.amount, 0))}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading payment records...</span>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30 text-emerald-600" />
              <p className="font-medium text-foreground">No payment records found for this period.</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                All deposits made will automatically organize here by date.
              </p>
            </div>
          ) : paymentViewMode === "grouped" ? (
            /* =========================================================
               VIEW 1: DATE-WISE GROUPED PAYMENTS (তারিখ অনুযায়ী মোট জমা)
               ========================================================= */
            <div className="space-y-3">
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 px-3.5 font-semibold">Payment Date</th>
                      <th className="py-3 px-3.5 text-right font-semibold">Total Paid on Date (মোট জমা)</th>
                      <th className="py-3 px-3.5 font-semibold">Payment Details / Notes</th>
                      <th className="py-3 px-3.5 text-right font-semibold">Time Recorded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredDateGroupedPayments.map((grp) => (
                      <tr key={grp.deposit_date} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-3.5 font-medium text-foreground whitespace-nowrap align-top">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-bold text-xs">{formatDate(grp.deposit_date)}</span>
                            <span className="text-[11px] text-muted-foreground">({grp.day_name})</span>
                            {grp.is_friday && (
                              <Badge
                                variant="outline"
                                className="text-[9px] border-amber-500/30 text-amber-700 dark:text-amber-400 py-0"
                              >
                                Friday
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground block mt-0.5 ml-5">
                            {grp.payment_count} {grp.payment_count > 1 ? "deposits" : "deposit"}
                          </span>
                        </td>

                        <td className="py-3.5 px-3.5 text-right whitespace-nowrap align-top">
                          <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-sm">
                            +{formatBDT(grp.total_amount)}
                          </span>
                        </td>

                        <td className="py-3.5 px-3.5 align-top">
                          <div className="space-y-1">
                            {grp.payments.map((p) => (
                              <div
                                key={p.id}
                                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/60 text-xs shadow-2xs mr-2"
                              >
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  +{formatBDT(p.amount)}
                                </span>
                                {p.note && (
                                  <span className="text-[10px] text-muted-foreground italic truncate max-w-[200px]" title={p.note}>
                                    • {p.note}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="py-3.5 px-3.5 text-right text-muted-foreground text-[11px] whitespace-nowrap align-top">
                          <div className="space-y-0.5">
                            {grp.payments.map((p) => (
                              <div key={p.id}>
                                <span className="font-medium text-foreground">
                                  {p.created_at ? formatDateTime(p.created_at) : "N/A"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Phone Card View */}
              <div className="sm:hidden space-y-2.5">
                {filteredDateGroupedPayments.map((grp) => (
                  <div
                    key={grp.deposit_date}
                    className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                        <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{formatDate(grp.deposit_date)}</span>
                        <span className="text-[11px] font-normal text-muted-foreground">({grp.day_name})</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md text-xs">
                          +{formatBDT(grp.total_amount)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-0.5">
                      {grp.payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-muted/40 border border-border/30"
                        >
                          <span className="text-muted-foreground truncate max-w-[200px]">
                            {p.note || "Regular Mess Deposit"}
                          </span>
                          <div className="text-right shrink-0 ml-2">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                              +{formatBDT(p.amount)}
                            </span>
                            {p.created_at && (
                              <span className="text-[9px] text-muted-foreground block">
                                {formatDateTime(p.created_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* =========================================================
               VIEW 2: INDIVIDUAL TRANSACTIONS (একক তালিকা)
               ========================================================= */
            <div className="space-y-3">
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 px-3.5 font-semibold">Payment Date</th>
                      <th className="py-3 px-3.5 font-semibold">Payment Note / Method</th>
                      <th className="py-3 px-3.5 text-right font-semibold">Amount Credited</th>
                      <th className="py-3 px-3.5 text-right font-semibold">Recorded Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3.5 font-medium text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{formatDate(p.deposit_date)}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3.5 text-muted-foreground">
                          {p.note || "Regular Mess Deposit"}
                        </td>

                        <td className="py-3 px-3.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
                          +{formatBDT(p.amount)}
                        </td>

                        <td className="py-3 px-3.5 text-right text-muted-foreground text-[11px] whitespace-nowrap">
                          {p.created_at ? formatDateTime(p.created_at) : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Phone Card View */}
              <div className="sm:hidden space-y-2.5">
                {filteredPayments.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-border bg-card shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>{formatDate(p.deposit_date)}</span>
                      </div>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                        +{formatBDT(p.amount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                      <span className="text-[11px] text-muted-foreground italic truncate max-w-[200px]">
                        {p.note || "Regular Deposit"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.created_at ? formatDateTime(p.created_at) : ""}
                      </span>
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
