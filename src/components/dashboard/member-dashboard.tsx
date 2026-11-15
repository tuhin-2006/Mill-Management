"use client";

import * as React from "react";
import {
  UtensilsCrossed,
  Wallet,
  TrendingUp,
  Receipt,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter,
  RotateCcw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT, formatDate, formatFullDate, getPresetDateRange, DatePreset } from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import { createClient } from "@/lib/supabase/client";
import { getMemberPersonalStatement } from "@/lib/services";
import { MemberPersonalStatement } from "@/types";
import { toast } from "sonner";

interface MemberDashboardProps {
  initialData: MemberPersonalStatement;
}

export function MemberDashboard({ initialData }: MemberDashboardProps) {
  const [data, setData] = React.useState<MemberPersonalStatement>(initialData);
  const [activeTab, setActiveTab] = React.useState<"all" | "meals" | "deposits">("all");
  const [activePreset, setActivePreset] = React.useState<DatePreset | "custom">("all");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [isLoadingRange, setIsLoadingRange] = React.useState(false);

  const member = data.member;
  const summary = data.summary;
  const isAdvance = summary.balance >= 0;

  const fetchStatement = React.useCallback(async (start?: string, end?: string) => {
    try {
      setIsLoadingRange(true);
      const supabase = createClient();
      const res = await getMemberPersonalStatement(supabase, member.id, start || undefined, end || undefined);
      if (res) {
        setData(res);
      }
    } catch (err: unknown) {
      toast.error("Failed to load records for date range: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsLoadingRange(false);
    }
  }, [member.id]);

  const handlePreset = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
      void fetchStatement(undefined, undefined);
    } else {
      const range = getPresetDateRange(preset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      void fetchStatement(range.startDate, range.endDate);
    }
  };

  const handleCustomStartDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset("custom");
    setStartDate(e.target.value);
    void fetchStatement(e.target.value, endDate);
  };

  const handleCustomEndDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset("custom");
    setEndDate(e.target.value);
    void fetchStatement(startDate, e.target.value);
  };

  const handleResetToAll = () => {
    handlePreset("all");
  };

  // Export personal records to CSV
  const handleExportCSV = () => {
    try {
      const headers = ["Date", "Day", "Lunch", "Dinner", "Total Meals", "Unit Price", "Meal Cost (BDT)"];
      const mealRows = data.dailyMeals.map((m) => [
        m.meal_date,
        m.day_name,
        m.lunch.toString(),
        m.dinner.toString(),
        m.total_meals.toString(),
        m.unit_price.toString(),
        m.cost.toString(),
      ]);

      downloadCSV(`personal_meal_history_${member.name.toLowerCase()}`, headers, mealRows);
      toast.success("Personal meal history exported to CSV.");
    } catch {
      toast.error("Failed to export personal CSV.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card shadow-xs">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Personal Member Portal
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-0.5">
            স্বাগতম, {member.name}!
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            View your meal attendance records, deposit ledger, and live personal balance.
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
            <span>Export My Records</span>
          </Button>
        </div>
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

          {/* Custom Date Pickers */}
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

      {/* Primary Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Balance */}
        <Card className={`border-2 ${isAdvance ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Current Balance (ব্যালেন্স)
              </span>
              <Badge variant={isAdvance ? "success" : "destructive"} className="text-[10px]">
                {isAdvance ? "Advance / জমা আছে" : "Due / বকেয়া আছে"}
              </Badge>
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold mt-2 ${isAdvance ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {formatBDT(summary.balance)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {isAdvance ? "You have credit in your account." : "Payment due. Please clear with admin."}
            </p>
          </CardContent>
        </Card>

        {/* Total Meals */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Meals (মোট মিল)
              </span>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground mt-2">
              {summary.total_meals}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {summary.total_lunch} Lunch &bull; {summary.total_dinner} Dinner
            </p>
          </CardContent>
        </Card>

        {/* Total Meal Expense */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Meal Expense (মিল খরচ)
              </span>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground mt-2">
              {formatBDT(summary.total_meal_cost)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Calculated at saved historical rates
            </p>
          </CardContent>
        </Card>

        {/* Total Deposited */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Deposited (মোট জমা)
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
              {formatBDT(summary.total_deposited)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Verified by mill administrator
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Summary Banner */}
      <div className="p-4 rounded-xl border border-dashed border-border bg-card/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-muted-foreground">
            <strong>Reconciliation formula:</strong> Total Deposited ({formatBDT(summary.total_deposited)}) - Meal Expense ({formatBDT(summary.total_meal_cost)}) = Net Balance ({formatBDT(summary.balance)}).
          </span>
        </div>
      </div>

      {/* Tabs & Records Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Button
            variant={activeTab === "all" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("all")}
            className="text-xs h-8"
          >
            All Activity
          </Button>
          <Button
            variant={activeTab === "meals" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("meals")}
            className="text-xs h-8"
          >
            Meal Records ({data.dailyMeals.length})
          </Button>
          <Button
            variant={activeTab === "deposits" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("deposits")}
            className="text-xs h-8"
          >
            Deposit Ledger ({data.deposits.length})
          </Button>
        </div>

        {/* Tab 1: Meal Records Table */}
        {(activeTab === "all" || activeTab === "meals") && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                <span>My Meal Attendance History</span>
              </CardTitle>
              <CardDescription>
                Chronological listing of your daily lunch and dinner meals with applied unit rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.dailyMeals.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No meal records recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground uppercase text-[10px] font-semibold">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Day</th>
                        <th className="py-2.5 px-3 text-center">Lunch</th>
                        <th className="py-2.5 px-3 text-center">Dinner</th>
                        <th className="py-2.5 px-3 text-center">Total Meals</th>
                        <th className="py-2.5 px-3 text-right">Unit Rate</th>
                        <th className="py-2.5 px-3 text-right">Cost (BDT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {data.dailyMeals.map((row) => (
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
                          <td className="py-2.5 px-3 text-center">{row.lunch > 0 ? row.lunch : "-"}</td>
                          <td className="py-2.5 px-3 text-center">
                            {row.is_friday ? (
                              <span className="text-[10px] text-muted-foreground">Closed</span>
                            ) : row.dinner > 0 ? (
                              row.dinner
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-foreground">
                            {row.total_meals}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">
                            {formatBDT(row.unit_price)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-foreground">
                            {formatBDT(row.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Deposit Ledger Table */}
        {(activeTab === "all" || activeTab === "deposits") && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>My Deposit History</span>
              </CardTitle>
              <CardDescription>
                Verified funds credited towards your mess account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.deposits.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No deposits recorded yet. Please submit your funds to the mess administrator.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground uppercase text-[10px] font-semibold">
                        <th className="py-2.5 px-3">Deposit Date</th>
                        <th className="py-2.5 px-3">Note / Reference</th>
                        <th className="py-2.5 px-3 text-right">Amount (BDT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {data.deposits.map((d) => (
                        <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-foreground">
                            {formatDate(d.deposit_date)}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {d.note || "Regular Mess Deposit"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            +{formatBDT(d.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
