"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  Calendar,
  UtensilsCrossed,
  Wallet,
  Receipt,
  Scale,
  Download,
  RotateCcw,
  Sun,
  Moon,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  History,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Member } from "@/types";
import { formatBDT, formatDate, getTodayInDhaka } from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface MemberDetailData {
  member: Member | null;
  dailyMeals: Array<{
    meal_date: string;
    day_name: string;
    lunch: number;
    dinner: number;
    total_meals: number;
    total_cost: number;
  }>;
  deposits: Array<{
    id: string;
    amount: number;
    deposit_date: string;
    note?: string | null;
  }>;
  summary: {
    total_meals: number;
    total_cost: number;
    total_deposited: number;
    balance: number;
  };
}

interface MemberDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: MemberDetailData | null;
  isLoading: boolean;
}

export function MemberDetailsModal({
  isOpen,
  onClose,
  data,
  isLoading,
}: MemberDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <MemberDetailsDialog
      key={data?.member?.id || "empty"}
      onClose={onClose}
      data={data}
      isLoading={isLoading}
    />
  );
}

function MemberDetailsDialog({
  onClose,
  data,
  isLoading,
}: {
  onClose: () => void;
  data: MemberDetailData | null;
  isLoading: boolean;
}) {
  const [activeTab, setActiveTab] = React.useState<"meals" | "deposits" | "timeline">("meals");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [activePreset, setActivePreset] = React.useState<"all" | "this_month" | "last_month" | "7_days" | "30_days" | "custom">("all");

  // Preset Date Handlers
  const applyPreset = (preset: "all" | "this_month" | "last_month" | "7_days" | "30_days") => {
    setActivePreset(preset);
    const today = getTodayInDhaka();
    const [yearStr, monthStr, dayStr] = today.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "this_month") {
      setStartDate(`${year}-${String(month).padStart(2, "0")}-01`);
      setEndDate(today);
    } else if (preset === "last_month") {
      const prevMonthDate = new Date(year, month - 2, 1);
      const lastDayOfPrevMonth = new Date(year, month - 1, 0);
      setStartDate(
        `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}-01`
      );
      setEndDate(
        `${lastDayOfPrevMonth.getFullYear()}-${String(lastDayOfPrevMonth.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfPrevMonth.getDate()).padStart(2, "0")}`
      );
    } else if (preset === "7_days") {
      const d7 = new Date(year, month - 1, day - 6);
      setStartDate(
        `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, "0")}-${String(d7.getDate()).padStart(2, "0")}`
      );
      setEndDate(today);
    } else if (preset === "30_days") {
      const d30 = new Date(year, month - 1, day - 29);
      setStartDate(
        `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, "0")}-${String(d30.getDate()).padStart(2, "0")}`
      );
      setEndDate(today);
    }
  };

  const handleCustomDateChange = (type: "start" | "end", value: string) => {
    setActivePreset("custom");
    if (type === "start") setStartDate(value);
    else setEndDate(value);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setActivePreset("all");
  };

  // 1. Previous / Opening Balance (Before startDate)
  const openingBalanceData = React.useMemo(() => {
    if (!data || !startDate) {
      return {
        hasOpening: false,
        previousMealsCount: 0,
        previousMealCost: 0,
        previousDeposited: 0,
        openingBalance: 0,
      };
    }

    const previousMeals = data.dailyMeals.filter((m) => m.meal_date < startDate);
    const previousDeposits = data.deposits.filter((d) => d.deposit_date < startDate);

    const previousMealsCount = previousMeals.reduce((acc, m) => acc + m.total_meals, 0);
    const previousMealCost = previousMeals.reduce((acc, m) => acc + m.total_cost, 0);
    const previousDeposited = previousDeposits.reduce((acc, d) => acc + d.amount, 0);
    const openingBalance = previousDeposited - previousMealCost;

    return {
      hasOpening: true,
      previousMealsCount,
      previousMealCost,
      previousDeposited,
      openingBalance,
    };
  }, [data, startDate]);

  // 2. Filtered Meals (Between startDate and endDate)
  const filteredMeals = React.useMemo(() => {
    if (!data) return [];
    return data.dailyMeals.filter((m) => {
      if (startDate && m.meal_date < startDate) return false;
      if (endDate && m.meal_date > endDate) return false;
      return true;
    });
  }, [data, startDate, endDate]);

  // 3. Filtered Deposits (Between startDate and endDate)
  const filteredDeposits = React.useMemo(() => {
    if (!data) return [];
    return data.deposits.filter((d) => {
      if (startDate && d.deposit_date < startDate) return false;
      if (endDate && d.deposit_date > endDate) return false;
      return true;
    });
  }, [data, startDate, endDate]);

  // 4. Filtered Period Activity & Final Closing Due / Balance
  const filteredSummary = React.useMemo(() => {
    const totalMeals = filteredMeals.reduce((acc, m) => acc + m.total_meals, 0);
    const totalCost = filteredMeals.reduce((acc, m) => acc + m.total_cost, 0);
    const totalDeposited = filteredDeposits.reduce((acc, d) => acc + d.amount, 0);
    const periodNet = totalDeposited - totalCost;

    // Closing Balance formula: Opening Balance + Period Net (Period Deposits - Period Cost)
    const closingBalance = openingBalanceData.openingBalance + periodNet;

    return {
      totalMeals,
      totalCost,
      totalDeposited,
      periodNet,
      closingBalance,
    };
  }, [filteredMeals, filteredDeposits, openingBalanceData]);

  // 5. Combined chronological ledger timeline
  const combinedTimeline = React.useMemo(() => {
    interface TimelineItem {
      id: string;
      date: string;
      type: "meal" | "deposit" | "opening";
      title: string;
      detail: string;
      inflow: number;
      outflow: number;
    }

    const items: TimelineItem[] = [];

    // Add opening balance item if date filter is active and has previous balance
    if (openingBalanceData.hasOpening) {
      items.push({
        id: "opening-balance",
        date: startDate,
        type: "opening",
        title: "Opening Balance (পূর্বের জের)",
        detail: `Balance before ${formatDate(startDate)} (Deposits: ${formatBDT(openingBalanceData.previousDeposited)}, Cost: ${formatBDT(openingBalanceData.previousMealCost)})`,
        inflow: openingBalanceData.openingBalance > 0 ? openingBalanceData.openingBalance : 0,
        outflow: openingBalanceData.openingBalance < 0 ? Math.abs(openingBalanceData.openingBalance) : 0,
      });
    }

    for (const m of filteredMeals) {
      items.push({
        id: `meal-${m.meal_date}`,
        date: m.meal_date,
        type: "meal",
        title: `${m.total_meals} Meal${m.total_meals > 1 ? "s" : ""} (Lunch: ${m.lunch}, Dinner: ${m.dinner})`,
        detail: m.day_name,
        inflow: 0,
        outflow: m.total_cost,
      });
    }

    for (const d of filteredDeposits) {
      items.push({
        id: `dep-${d.id}`,
        date: d.deposit_date,
        type: "deposit",
        title: `Deposit Added`,
        detail: d.note || "No note",
        inflow: d.amount,
        outflow: 0,
      });
    }

    // Sort descending by date (opening balance appears at bottom if descending, or sort ascending)
    items.sort((a, b) => b.date.localeCompare(a.date));
    return items;
  }, [filteredMeals, filteredDeposits, openingBalanceData, startDate]);

  // CSV Statement Export
  const handleExportCSV = () => {
    if (!data?.member) return;
    const memberName = data.member.name;
    const rangeLabel = startDate || endDate ? `${startDate || "start"}_to_${endDate || "latest"}` : "all_time";
    const filename = `${memberName}_statement_${rangeLabel}`;

    const headers = ["Date", "Type", "Details", "Inflow (Deposit)", "Outflow (Meal Cost)", "Net Impact"];
    const rows = combinedTimeline.map((item) => [
      item.date,
      item.type === "deposit" ? "Deposit" : item.type === "opening" ? "Opening Balance" : "Meal",
      item.title,
      item.inflow > 0 ? item.inflow : "",
      item.outflow > 0 ? item.outflow : "",
      item.inflow - item.outflow,
    ]);

    downloadCSV(filename, headers, rows);
  };

  const isFiltered = Boolean(startDate || endDate);
  const memberName = data?.member?.name || "Member";
  const initial = memberName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl border-border bg-card overflow-hidden rounded-xl sm:rounded-2xl">
        {/* Modal Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/80 px-4 sm:px-6 py-3.5 sm:py-4.5 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-gradient-to-tr from-primary to-primary/60 text-primary-foreground font-bold text-sm sm:text-base flex items-center justify-center shadow-sm ring-2 ring-primary/20 shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <CardTitle className="text-base sm:text-xl font-bold tracking-tight text-foreground truncate">
                  {memberName}
                </CardTitle>
                <Badge variant={data?.member?.status === "active" ? "success" : "secondary"} className="shrink-0 text-[10px]">
                  {data?.member?.status || "active"}
                </Badge>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                Activity summary, meal records, and deposit ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {data?.member && (
              <Link href={`/ledger?member=${data.member.id}`} onClick={onClose}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 hidden md:inline-flex text-primary hover:text-primary"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Full Ledger</span>
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={isLoading || !data}
              className="h-8 text-xs gap-1.5 hidden sm:inline-flex"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Export CSV</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>

        {/* Modal Body */}
        <CardContent className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          {isLoading ? (
            <div className="py-20 text-center text-sm text-muted-foreground animate-pulse">
              Loading member details & activity records...
            </div>
          ) : !data ? (
            <div className="py-20 text-center text-sm text-muted-foreground">
              No data available for this member.
            </div>
          ) : (
            <>
              {/* Date Filter Toolbar */}
              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                      <Filter className="h-3 w-3" /> Filter:
                    </span>
                    <Button
                      variant={activePreset === "all" ? "primary" : "outline"}
                      size="sm"
                      onClick={() => applyPreset("all")}
                      className="h-7 text-xs px-2.5 rounded-lg"
                    >
                      All Time
                    </Button>
                    <Button
                      variant={activePreset === "this_month" ? "primary" : "outline"}
                      size="sm"
                      onClick={() => applyPreset("this_month")}
                      className="h-7 text-xs px-2.5 rounded-lg"
                    >
                      This Month
                    </Button>
                    <Button
                      variant={activePreset === "last_month" ? "primary" : "outline"}
                      size="sm"
                      onClick={() => applyPreset("last_month")}
                      className="h-7 text-xs px-2.5 rounded-lg"
                    >
                      Last Month
                    </Button>
                    <Button
                      variant={activePreset === "30_days" ? "primary" : "outline"}
                      size="sm"
                      onClick={() => applyPreset("30_days")}
                      className="h-7 text-xs px-2.5 rounded-lg"
                    >
                      Last 30 Days
                    </Button>
                    <Button
                      variant={activePreset === "7_days" ? "primary" : "outline"}
                      size="sm"
                      onClick={() => applyPreset("7_days")}
                      className="h-7 text-xs px-2.5 rounded-lg"
                    >
                      Last 7 Days
                    </Button>
                  </div>

                  {/* Manual Date Range Inputs */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => handleCustomDateChange("start", e.target.value)}
                        className="h-8 text-xs py-1 px-2 w-full sm:w-32 bg-background"
                        title="Start Date"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">to</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => handleCustomDateChange("end", e.target.value)}
                      className="h-8 text-xs py-1 px-2 w-full sm:w-32 flex-1 sm:flex-initial bg-background"
                      title="End Date"
                    />

                    {isFiltered && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 shrink-0"
                        title="Clear filter"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span className="inline">Reset</span>
                      </Button>
                    )}
                  </div>
                </div>

                {isFiltered && (
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      📅 Filtered Period:{" "}
                      <span className="text-primary font-semibold">
                        {startDate ? formatDate(startDate) : "Beginning"}
                      </span>{" "}
                      —{" "}
                      <span className="text-primary font-semibold">
                        {endDate ? formatDate(endDate) : "Latest"}
                      </span>
                    </span>
                    <span>
                      Matching {filteredMeals.length} days of meals & {filteredDeposits.length} deposits
                    </span>
                  </div>
                )}
              </div>

              {/* Financial Reconciliation Breakdown Banner (Step 3 Requirement) */}
              {isFiltered && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        হিসাব সমন্বয় ও চূড়ান্ত ব্যালেন্স বিবরণী (Ledger Reconciliation)
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {startDate ? formatDate(startDate) : "Beginning"} হতে {endDate ? formatDate(endDate) : "বর্তমান"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {/* 1. Opening Balance */}
                    <div className="p-3 bg-card rounded-xl border border-border flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                        ১. পূর্বের ব্যালেন্স (Opening)
                      </span>
                      <p
                        className={`text-lg font-black mt-1 ${
                          openingBalanceData.openingBalance >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                        }`}
                      >
                        {formatBDT(openingBalanceData.openingBalance)}
                      </p>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {openingBalanceData.openingBalance < 0
                          ? "⚠️ পূর্বের বকেয়া ছিল"
                          : openingBalanceData.openingBalance > 0
                          ? "✅ পূর্বের অগ্রিম জমা ছিল"
                          : "পূর্বের জের শূন্য ছিল"}
                      </span>
                    </div>

                    {/* 2. Period Expense */}
                    <div className="p-3 bg-card rounded-xl border border-border flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                        ২. বর্তমান খরচ (Period Cost)
                      </span>
                      <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
                        -{formatBDT(filteredSummary.totalCost)}
                      </p>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {filteredSummary.totalMeals}টি মিলের খরচ
                      </span>
                    </div>

                    {/* 3. Period Deposited */}
                    <div className="p-3 bg-card rounded-xl border border-border flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                        ৩. বর্তমান জমা (Period Deposit)
                      </span>
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        +{formatBDT(filteredSummary.totalDeposited)}
                      </p>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {filteredDeposits.length}টি জমার লেনদেন
                      </span>
                    </div>

                    {/* 4. Final Closing Due / Balance */}
                    <div
                      className={`p-3 rounded-xl border flex flex-col justify-between ${
                        filteredSummary.closingBalance >= 0
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "bg-destructive/10 border-destructive/30"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-foreground">
                        ৪. সর্বমোট চূড়ান্ত {filteredSummary.closingBalance < 0 ? "বকেয়া (Final Due)" : "ব্যালেন্স"}
                      </span>
                      <p
                        className={`text-xl font-black mt-1 ${
                          filteredSummary.closingBalance >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                        }`}
                      >
                        {formatBDT(filteredSummary.closingBalance)}
                      </p>
                      <span className="text-[10px] font-semibold mt-0.5">
                        {filteredSummary.closingBalance < 0 ? (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> সর্বমোট পাওনা / Due
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> সর্বমোট জমা / Advance
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Financial Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Meals Card */}
                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      Total Meals
                    </span>
                    <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      <UtensilsCrossed className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-foreground mt-2 tracking-tight">
                    {filteredSummary.totalMeals}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {isFiltered
                      ? `In filtered range (All-time: ${data.summary.total_meals})`
                      : `${filteredMeals.length} active meal days`}
                  </p>
                </div>

                {/* 2. Meal Cost Card */}
                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                      Total Meal Cost
                    </span>
                    <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
                      <Receipt className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 tracking-tight">
                    {formatBDT(filteredSummary.totalCost)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {isFiltered
                      ? `Period expense (All-time: ${formatBDT(data.summary.total_cost)})`
                      : "Total meal expenses"}
                  </p>
                </div>

                {/* 3. Deposited Card */}
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Total Deposited
                    </span>
                    <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Wallet className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 tracking-tight">
                    {formatBDT(filteredSummary.totalDeposited)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {isFiltered
                      ? `Deposited in period (${filteredDeposits.length} txns)`
                      : `Total credited (${data.deposits.length} txns)`}
                  </p>
                </div>

                {/* 4. Net Balance / Closing Due Card */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    (isFiltered ? filteredSummary.closingBalance : data.summary.balance) >= 0
                      ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-destructive/20 bg-destructive/5 dark:bg-destructive/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {isFiltered ? "সর্বমোট চূড়ান্ত বকেয়া / ব্যালেন্স" : "Net Balance"}
                    </span>
                    <div
                      className={`p-1.5 rounded-lg ${
                        (isFiltered ? filteredSummary.closingBalance : data.summary.balance) >= 0
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      <Scale className="h-4 w-4" />
                    </div>
                  </div>
                  <p
                    className={`text-2xl font-black mt-2 tracking-tight ${
                      (isFiltered ? filteredSummary.closingBalance : data.summary.balance) >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                    }`}
                  >
                    {formatBDT(isFiltered ? filteredSummary.closingBalance : data.summary.balance)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                    {isFiltered ? (
                      <span>
                        {filteredSummary.closingBalance < 0
                          ? "সর্বমোট পাওনা (Previous Due + Period Net)"
                          : "সর্বমোট জমা (Previous Credit + Period Net)"}
                      </span>
                    ) : data.summary.balance >= 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Advance / Credit
                      </span>
                    ) : (
                      <span className="text-destructive flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" /> Payment Due
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* View Tabs */}
              <div className="flex items-center border-b border-border gap-2 overflow-x-auto whitespace-nowrap pb-0">
                <button
                  type="button"
                  onClick={() => setActiveTab("meals")}
                  className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                    activeTab === "meals"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  <span>Meal Records</span>
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-muted text-foreground font-mono">
                    {filteredMeals.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("deposits")}
                  className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                    activeTab === "deposits"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Wallet className="h-4 w-4" />
                  <span>Deposits</span>
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-muted text-foreground font-mono">
                    {filteredDeposits.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("timeline")}
                  className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                    activeTab === "timeline"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  <span>Full Timeline</span>
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-muted text-foreground font-mono">
                    {combinedTimeline.length}
                  </span>
                </button>
              </div>

              {/* Tab 1: Meal Records Table */}
              {activeTab === "meals" && (
                <div className="space-y-3">
                  {filteredMeals.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
                      <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium">No meal entries found for this time period.</p>
                      {isFiltered && (
                        <p className="text-xs mt-1">Try expanding or clearing the date filter.</p>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-border rounded-xl shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border">
                          <tr>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Weekday</th>
                            <th className="py-3 px-4 text-center">Lunch (দুপুর)</th>
                            <th className="py-3 px-4 text-center">Dinner (রাত)</th>
                            <th className="py-3 px-4 text-center">Meals</th>
                            <th className="py-3 px-4 text-right">Total Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredMeals.map((dm) => (
                            <tr key={dm.meal_date} className="hover:bg-muted/30 transition-colors">
                              <td className="py-3 px-4 font-semibold text-foreground">
                                {formatDate(dm.meal_date)}
                              </td>
                              <td className="py-3 px-4">
                                <span className={dm.day_name === "Friday" ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground"}>
                                  {dm.day_name}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {dm.lunch > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">
                                    <Sun className="h-3 w-3" /> {dm.lunch} {dm.lunch > 1 ? `(${dm.lunch - 1} Guest)` : "Meal"}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/60">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {dm.day_name === "Friday" ? (
                                  <span className="text-[10px] text-muted-foreground/60 italic">Disabled</span>
                                ) : dm.dinner > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium">
                                    <Moon className="h-3 w-3" /> {dm.dinner} {dm.dinner > 1 ? `(${dm.dinner - 1} Guest)` : "Meal"}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/60">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-bold px-2 py-0.5 rounded-md bg-muted text-foreground">
                                  {dm.total_meals}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                                {formatBDT(dm.total_cost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/40 font-bold border-t border-border">
                          <tr>
                            <td colSpan={4} className="py-3 px-4 text-foreground">
                              Period Totals ({filteredMeals.length} days)
                            </td>
                            <td className="py-3 px-4 text-center text-foreground font-black">
                              {filteredSummary.totalMeals}
                            </td>
                            <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400 font-black">
                              {formatBDT(filteredSummary.totalCost)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {/* Payment & Deposit History for Member Organized by Date */}
                  <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-bold text-xs uppercase tracking-wider text-foreground">
                          Payment & Deposit Records (কবে টাকা জমা হয়েছে)
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {filteredDeposits.length} Payments (+{formatBDT(filteredSummary.totalDeposited)})
                      </Badge>
                    </div>

                    {filteredDeposits.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center border border-dashed border-border rounded-lg">
                        No payments recorded for this member in this period.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-border/60">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border/40">
                            <tr>
                              <th className="py-2.5 px-3">Payment Date</th>
                              <th className="py-2.5 px-3">Payment Note</th>
                              <th className="py-2.5 px-3 text-right">Amount Credited</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {filteredDeposits.map((dep) => (
                              <tr key={dep.id} className="hover:bg-muted/20">
                                <td className="py-2.5 px-3 font-medium text-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span>{formatDate(dep.deposit_date)}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground">
                                  {dep.note || "Regular Mess Deposit"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                  +{formatBDT(dep.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Deposit History Table */}
              {activeTab === "deposits" && (
                <div className="space-y-3">
                  {filteredDeposits.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
                      <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium">No deposit transactions found for this time period.</p>
                      {isFiltered && (
                        <p className="text-xs mt-1">Try expanding or clearing the date filter.</p>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-border rounded-xl shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border">
                          <tr>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Amount Deposited</th>
                            <th className="py-3 px-4">Payment Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredDeposits.map((dep) => (
                            <tr key={dep.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-3 px-4 font-semibold text-foreground">
                                {formatDate(dep.deposit_date)}
                              </td>
                              <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                                +{formatBDT(dep.amount)}
                              </td>
                              <td className="py-3 px-4 text-muted-foreground">
                                {dep.note ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md bg-muted text-foreground font-medium">
                                    {dep.note}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/60">No note provided</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/40 font-bold border-t border-border">
                          <tr>
                            <td className="py-3 px-4 text-foreground">
                              Total Deposited ({filteredDeposits.length} transactions)
                            </td>
                            <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-black">
                              +{formatBDT(filteredSummary.totalDeposited)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Full Timeline Table */}
              {activeTab === "timeline" && (
                <div className="space-y-3">
                  {combinedTimeline.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium">No activity recorded for this period.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-border rounded-xl shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border">
                          <tr>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Activity Type</th>
                            <th className="py-3 px-4">Description</th>
                            <th className="py-3 px-4 text-right">Inflow (+)</th>
                            <th className="py-3 px-4 text-right">Outflow (-)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {combinedTimeline.map((item) => (
                            <tr
                              key={item.id}
                              className={`hover:bg-muted/30 transition-colors ${
                                item.type === "opening" ? "bg-primary/5 font-semibold" : ""
                              }`}
                            >
                              <td className="py-3 px-4 font-semibold text-foreground">
                                {item.type === "opening" ? (
                                  <span className="text-primary font-bold">
                                    &lt; {formatDate(item.date)}
                                  </span>
                                ) : (
                                  formatDate(item.date)
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {item.type === "deposit" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                                    <ArrowDownLeft className="h-3 w-3" /> Deposit
                                  </span>
                                ) : item.type === "opening" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[11px]">
                                    <History className="h-3 w-3" /> Opening Balance
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold text-[11px]">
                                    <ArrowUpRight className="h-3 w-3" /> Meal Expense
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-foreground font-medium">
                                {item.title}{" "}
                                {item.detail && item.detail !== "No note" && (
                                  <span className="text-muted-foreground text-[11px]">
                                    ({item.detail})
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                {item.inflow > 0 ? `+${formatBDT(item.inflow)}` : "—"}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                                {item.outflow > 0 ? `-${formatBDT(item.outflow)}` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/40 font-bold border-t border-border">
                          <tr>
                            <td colSpan={3} className="py-3 px-4 text-foreground">
                              {isFiltered ? "সর্বমোট চূড়ান্ত ফলাফল (Final Closing Balance):" : "Period Net Change:"}
                            </td>
                            <td colSpan={2} className="py-3 px-4 text-right font-black text-sm">
                              <span
                                className={
                                  (isFiltered ? filteredSummary.closingBalance : filteredSummary.periodNet) >= 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-destructive"
                                }
                              >
                                {formatBDT(isFiltered ? filteredSummary.closingBalance : filteredSummary.periodNet)}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
