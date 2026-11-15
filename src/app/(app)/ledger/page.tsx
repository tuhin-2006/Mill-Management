"use client";

import * as React from "react";
import {
  Download,
  Calendar,
  Filter,
  RotateCcw,
  UtensilsCrossed,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPeriodLedgerReport } from "@/lib/services";
import {
  formatBDT,
  formatDate,
  getPresetDateRange,
  DatePreset,
} from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import { PeriodLedgerReport } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function TotalMillLedgerPage() {
  const defaultRange = React.useMemo(() => getPresetDateRange("this_month"), []);
  const [activePreset, setActivePreset] = React.useState<DatePreset | "custom">("this_month");
  const [startDate, setStartDate] = React.useState(defaultRange.startDate);
  const [endDate, setEndDate] = React.useState(defaultRange.endDate);

  const [report, setReport] = React.useState<PeriodLedgerReport | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let ignore = false;
    async function fetchLedger() {
      try {
        setIsLoading(true);
        const supabase = createClient();
        const data = await getPeriodLedgerReport(supabase, startDate, endDate);
        if (!ignore) {
          setReport(data);
        }
      } catch (err: unknown) {
        if (!ignore) {
          toast.error("Failed to load ledger: " + (err instanceof Error ? err.message : ""));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void fetchLedger();
    return () => {
      ignore = true;
    };
  }, [startDate, endDate]);

  // Handle Preset Buttons
  const handlePreset = (preset: DatePreset) => {
    const range = getPresetDateRange(preset);
    setActivePreset(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const handleCustomStartDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset("custom");
    setStartDate(e.target.value);
  };

  const handleCustomEndDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset("custom");
    setEndDate(e.target.value);
  };

  const handleResetToAll = () => {
    handlePreset("all");
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!report || report.dailyRows.length === 0) {
      toast.info("No daily meal records to export for this period.");
      return;
    }

    const headers = [
      "Date",
      "Weekday",
      "Friday",
      "Lunch Meals",
      "Dinner Meals",
      "Total Meals",
      "Daily Cost (BDT)",
      "Members Ate",
    ];

    const rows = report.dailyRows.map((r) => [
      r.meal_date,
      r.day_name,
      r.is_friday ? "Yes" : "No",
      r.lunch_count,
      r.dinner_count,
      r.total_meals,
      r.total_cost,
      r.active_members_ate,
    ]);

    const rangeLabel = startDate
      ? `${startDate}_to_${endDate || "current"}`
      : "all_records";
    downloadCSV(`total_mill_ledger_${rangeLabel}`, headers, rows);
    toast.success("Daily meal ledger exported to CSV successfully.");
  };

  const isPreviousDue = (report?.opening.balance ?? 0) < 0;
  const isClosingPositive = (report?.closing.balance ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Total Mill Ledger"
        description="Comprehensive group meal accounting, daily consumption records, and period settlements."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-2 h-9 text-xs"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
        }
      />

      {/* Date Filter & Presets Bar */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-4 sm:p-5 space-y-3.5">
          {/* Preset Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-none">
              <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1 shrink-0">
                <Filter className="h-3.5 w-3.5" />
                <span>Period:</span>
              </span>
              <button
                type="button"
                onClick={() => handlePreset("this_month")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                  activePreset === "this_month"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handlePreset("this_week")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                  activePreset === "this_week"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                This Week
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
                Last Month
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
                All Time
              </button>
            </div>

            {/* Current Range Label */}
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                {startDate
                  ? `${formatDate(startDate)} → ${endDate ? formatDate(endDate) : "Today"}`
                  : "All Records (Inception to Date)"}
              </span>
            </div>
          </div>

          {/* Custom Date Pickers */}
          <div className="pt-2 border-t border-border/60 flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[140px]">
              <Label htmlFor="start-date" className="text-[11px] font-semibold text-muted-foreground">
                From Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={handleCustomStartDate}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[140px]">
              <Label htmlFor="end-date" className="text-[11px] font-semibold text-muted-foreground">
                To Date
              </Label>
              <Input
                id="end-date"
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
                onClick={handleResetToAll}
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
                Previous Balance
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
              {!startDate ? "৳0" : formatBDT(report?.opening.balance ?? 0)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {!startDate
                ? "Starting from inception"
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
              +{formatBDT(report?.period.total_deposit ?? 0)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Period net: {formatBDT(report?.period.net_flow ?? 0)}
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
                Net Current Balance
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
              {formatBDT(report?.closing.balance ?? 0)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Previous Balance + Deposits - Meal Cost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Meal Ledger Records Table */}
      <Card className="border-border shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold">
              Daily Meal Records
            </CardTitle>
            <CardDescription>
              Detailed daily session consumption, meal costs, and active member attendance
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
              <span>Loading daily meal ledger...</span>
            </div>
          ) : !report || report.dailyRows.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No daily meal entries found in this selected period.
            </div>
          ) : (
            <>
              {/* Desktop & Tablet Table View */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">Weekday</th>
                      <th className="py-3 px-4 text-center font-semibold">Lunch</th>
                      <th className="py-3 px-4 text-center font-semibold">Dinner</th>
                      <th className="py-3 px-4 text-center font-semibold">Total Meals</th>
                      <th className="py-3 px-4 text-right font-semibold">Daily Cost</th>
                      <th className="py-3 px-4 text-right font-semibold">Members Ate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.dailyRows.map((row) => (
                      <tr key={row.meal_date} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">
                          {formatDate(row.meal_date)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{row.day_name}</span>
                            {row.is_friday && (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-400"
                              >
                                Friday
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-medium">{row.lunch_count}</td>
                        <td className="py-3 px-4 text-center font-medium">{row.dinner_count}</td>
                        <td className="py-3 px-4 text-center font-bold text-foreground">
                          {row.total_meals}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-primary">
                          {formatBDT(row.total_cost)}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">
                          {row.active_members_ate} members
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-2.5">
                {report.dailyRows.map((row) => (
                  <div
                    key={row.meal_date}
                    className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          {formatDate(row.meal_date)}
                        </span>
                        <span className="text-xs text-muted-foreground">({row.day_name})</span>
                        {row.is_friday && (
                          <Badge
                            variant="outline"
                            className="text-[9px] border-amber-500/30 text-amber-700 dark:text-amber-400"
                          >
                            Friday
                          </Badge>
                        )}
                      </div>
                      <span className="font-bold text-primary text-sm">
                        {formatBDT(row.total_cost)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-muted/40 text-xs text-center border border-border/40">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Lunch</span>
                        <span className="font-semibold text-foreground">{row.lunch_count}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Dinner</span>
                        <span className="font-semibold text-foreground">{row.dinner_count}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Total Meals</span>
                        <span className="font-bold text-primary">{row.total_meals}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground text-right">
                      {row.active_members_ate} members recorded
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
