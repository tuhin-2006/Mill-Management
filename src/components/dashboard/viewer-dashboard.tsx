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

  const period = report.period;
  const lifetime = report.lifetime;
  const isSurplus = lifetime.balance >= 0;

  // Export aggregate records to CSV
  const handleExportCSV = () => {
    try {
      const headers = ["Date", "Day", "Lunch Count", "Dinner Count", "Total Meals", "Total Meal Cost (BDT)", "Collected Deposits (BDT)"];
      const rows = report.daily_rows.map((r) => [
        r.meal_date,
        r.day_name,
        r.lunch_count.toString(),
        r.dinner_count.toString(),
        r.total_meals.toString(),
        r.total_cost.toString(),
        r.total_deposit.toString(),
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

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Group Net Balance */}
        <Card className={`border-2 ${isSurplus ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Group Treasury Balance
              </span>
              <Badge variant={isSurplus ? "success" : "destructive"} className="text-[10px]">
                {isSurplus ? "Surplus / উদ্বৃত্ত" : "Deficit / ঘাটতি"}
              </Badge>
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold mt-2 ${isSurplus ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {formatBDT(lifetime.balance)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Total Funds ({formatBDT(lifetime.total_deposits)}) - Total Expenses ({formatBDT(lifetime.total_expenses)})
            </p>
          </CardContent>
        </Card>

        {/* Total Group Meals */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Group Meals
              </span>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground mt-2">
              {period.total_meals}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {period.total_lunch} Lunch &bull; {period.total_dinner} Dinner
            </p>
          </CardContent>
        </Card>

        {/* Total Meal Expense */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Group Meal Expenses
              </span>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground mt-2">
              {formatBDT(period.total_cost)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Applied at daily unit rates (incl. Friday rate)
            </p>
          </CardContent>
        </Card>

        {/* Total Group Deposits */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Group Deposits
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
              {formatBDT(period.total_deposit)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {lifetime.active_members_count} active mess members
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Group Ledger Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-primary" />
            <span>সম্মিলিত দৈনিক মিলের খতিয়ান (Daily Group Ledger)</span>
          </CardTitle>
          <CardDescription>
            Aggregated attendance figures and group costs by date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.daily_rows.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No ledger records found for this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase text-[10px] font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Day</th>
                    <th className="py-2.5 px-3 text-center">Group Lunch</th>
                    <th className="py-2.5 px-3 text-center">Group Dinner</th>
                    <th className="py-2.5 px-3 text-center">Total Meals</th>
                    <th className="py-2.5 px-3 text-right">Daily Cost (BDT)</th>
                    <th className="py-2.5 px-3 text-right">Collected (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {report.daily_rows.map((row) => (
                    <tr key={row.meal_date} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {formatDate(row.meal_date)}
                        {row.is_friday && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-semibold">
                            Friday
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{row.day_name}</td>
                      <td className="py-2.5 px-3 text-center">{row.lunch_count}</td>
                      <td className="py-2.5 px-3 text-center">
                        {row.is_friday ? (
                          <span className="text-[10px] text-muted-foreground">Closed</span>
                        ) : (
                          row.dinner_count
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-foreground">
                        {row.total_meals}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        {formatBDT(row.total_cost)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                        {row.total_deposit > 0 ? `+${formatBDT(row.total_deposit)}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
