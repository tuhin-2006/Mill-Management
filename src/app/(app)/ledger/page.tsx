"use client";

import * as React from "react";
import Link from "next/link";
import {
  Download,
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Search,
  X,
  RotateCcw,
  Filter,
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
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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

export default function TotalMillLedgerPage() {
  // Preset defaults to 'this_month' for the most practical everyday view
  const defaultRange = React.useMemo(() => getPresetDateRange("this_month"), []);
  const [activePreset, setActivePreset] = React.useState<DatePreset | "custom">("this_month");
  const [startDate, setStartDate] = React.useState(defaultRange.startDate);
  const [endDate, setEndDate] = React.useState(defaultRange.endDate);

  const [report, setReport] = React.useState<PeriodLedgerReport | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"members" | "daily">("members");
  const [searchTerm, setSearchTerm] = React.useState("");

  React.useEffect(() => {
    let ignore = false;
    async function init() {
      try {
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

    void init();
    return () => {
      ignore = true;
    };
  }, [startDate, endDate]);

  // Handle Preset Clicks
  const handlePresetClick = (preset: DatePreset) => {
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
    handlePresetClick("all");
  };

  // Filter member statements by search term
  const filteredMembers = React.useMemo(() => {
    if (!report) return [];
    if (!searchTerm.trim()) return report.memberStatements;
    const query = searchTerm.toLowerCase();
    return report.memberStatements.filter((m) =>
      m.member_name.toLowerCase().includes(query)
    );
  }, [report, searchTerm]);

  // Export CSV
  const handleExportCSV = () => {
    if (!report) {
      toast.info("No ledger entries to export.");
      return;
    }

    if (activeTab === "members") {
      const headers = [
        "Member Name",
        "Status",
        "Previous Balance (BDT)",
        "Previous Unpaid (BDT)",
        "Period Meals",
        "Period Lunch",
        "Period Dinner",
        "Period Cost (BDT)",
        "Period Deposits (BDT)",
        "Period Net Flow (BDT)",
        "Closing Balance (BDT)",
        "Closing Unpaid (BDT)",
      ];

      const rows = report.memberStatements.map((m) => [
        m.member_name,
        m.status,
        m.previous_balance,
        m.previous_unpaid,
        m.period_meals,
        m.period_lunch,
        m.period_dinner,
        m.period_cost,
        m.period_deposit,
        m.period_net,
        m.closing_balance,
        m.closing_unpaid,
      ]);

      const prefix = startDate ? `${startDate}_to_${endDate || "now"}` : "all_time";
      downloadCSV(`member_statement_${prefix}`, headers, rows);
      toast.success("Member ledger statement exported to CSV.");
    } else {
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

      const prefix = startDate ? `${startDate}_to_${endDate || "now"}` : "all_time";
      downloadCSV(`daily_ledger_${prefix}`, headers, rows);
      toast.success("Daily ledger logs exported to CSV.");
    }
  };

  const isPreviousDue = (report?.opening.balance ?? 0) < 0;
  const isClosingPositive = (report?.closing.balance ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Total Mill Ledger"
        description="Comprehensive accounting statement: previous unpaid/advance balance, new updates, and period settlements."
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

      {/* Preset & Custom Date Filtering Control Bar */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-4 sm:p-5 space-y-3.5">
          {/* Quick Preset Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-none">
              <span className="text-xs font-semibold text-muted-foreground mr-1.5 flex items-center gap-1 shrink-0">
                <Filter className="h-3.5 w-3.5" />
                <span>Period:</span>
              </span>
              <button
                type="button"
                onClick={() => handlePresetClick("this_month")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                  activePreset === "this_month"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                This Month (চলতি মাস)
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick("this_week")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                  activePreset === "this_week"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                This Week (চলতি সপ্তাহ)
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick("last_month")}
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
                onClick={() => handlePresetClick("all")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                  activePreset === "all"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                All Time (সব সময়)
              </button>
            </div>

            {/* Range Indicator */}
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                {startDate
                  ? `${formatDate(startDate)} → ${endDate ? formatDate(endDate) : "Today"}`
                  : "All Records (Inception to Date)"}
              </span>
            </div>
          </div>

          {/* Date Picker Row */}
          <div className="pt-2 border-t border-border/60 flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[140px]">
              <Label htmlFor="start-date" className="text-[11px] font-semibold text-muted-foreground">
                From Date (তারিখ থেকে)
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
                To Date (তারিখ পর্যন্ত)
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
        {/* 1. Opening / Previous Balance */}
        <Card
          className={`border shadow-xs transition-all ${
            !startDate
              ? "border-border"
              : isPreviousDue
              ? "border-rose-500/40 bg-gradient-to-br from-card via-card to-rose-500/5"
              : "border-emerald-500/40 bg-gradient-to-br from-card via-card to-emerald-500/5"
          }`}
        >
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Previous Balance (আগের হিসাব)
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
                ? "Starting from day one"
                : `Cost: ${formatBDT(report?.opening.total_cost ?? 0)} • Dep: ${formatBDT(
                    report?.opening.total_deposit ?? 0
                  )}`}
            </p>
          </CardContent>
        </Card>

        {/* 2. New Period Meal Expense */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Period Meal Cost (নতুন মিল খরচ)
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {report?.period.total_meals ?? 0} meals
              </Badge>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-foreground truncate">
              {formatBDT(report?.period.total_cost ?? 0)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Lunch: {report?.period.lunch_count ?? 0} • Dinner: {report?.period.dinner_count ?? 0}
            </p>
          </CardContent>
        </Card>

        {/* 3. New Period Deposits */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Period Deposits (নতুন জমা)
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Received
              </Badge>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 truncate">
              +{formatBDT(report?.period.total_deposit ?? 0)}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Period net: {formatBDT(report?.period.net_flow ?? 0)}
            </p>
          </CardContent>
        </Card>

        {/* 4. Net Closing / Current Balance */}
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
                Net Current Balance (বর্তমান স্থিতি)
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
              Opening + Period Deposits - Period Meals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Ledger Content: Tabs & Tables */}
      <Card className="border-border shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          {/* Tab Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "members"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Member Statement ({report?.memberStatements.length ?? 0} Members)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("daily")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "daily"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Daily Logs ({report?.dailyRows.length ?? 0} Days)
            </button>
          </div>

          {/* Member Search input if on member tab */}
          {activeTab === "members" && (
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search member..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-7 h-8 text-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Calculating period ledger statements...</span>
            </div>
          ) : activeTab === "members" ? (
            // =========================================================================
            // TAB 1: MEMBER-WISE STATEMENT (Previous Due + New Meals + Deposits + Closing)
            // =========================================================================
            filteredMembers.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No members match your criteria.
              </div>
            ) : (
              <>
                {/* Desktop & Tablet View */}
                <div className="hidden lg:block overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[11px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Member</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 text-right font-semibold">
                          Previous Due / Advance
                          <span className="block text-[9px] font-normal lowercase">
                            {startDate ? `(before ${formatDate(startDate)})` : "(all-time)"}
                          </span>
                        </th>
                        <th className="py-3 px-4 text-center font-semibold">
                          New Meals
                          <span className="block text-[9px] font-normal lowercase">(in period)</span>
                        </th>
                        <th className="py-3 px-4 text-right font-semibold">
                          New Meal Cost
                          <span className="block text-[9px] font-normal lowercase">(in period)</span>
                        </th>
                        <th className="py-3 px-4 text-right font-semibold">
                          New Deposits
                          <span className="block text-[9px] font-normal lowercase">(in period)</span>
                        </th>
                        <th className="py-3 px-4 text-right font-semibold">
                          Closing Net Balance
                          <span className="block text-[9px] font-normal lowercase">
                            (previous + dep - meals)
                          </span>
                        </th>
                        <th className="py-3 px-4 text-center font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredMembers.map((m) => {
                        const avatarColor = getAvatarColor(m.member_name);
                        const initials = getInitials(m.member_name);
                        const isPrevNeg = m.previous_balance < 0;
                        const isCloseNeg = m.closing_balance < 0;

                        return (
                          <tr key={m.member_id} className="hover:bg-muted/40 transition-colors">
                            {/* Member Name */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor}`}
                                >
                                  {initials}
                                </div>
                                <span className="font-semibold text-foreground">
                                  {m.member_name}
                                </span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4">
                              <Badge
                                variant={m.status === "active" ? "success" : "secondary"}
                                className="capitalize text-[10px]"
                              >
                                {m.status}
                              </Badge>
                            </td>

                            {/* Previous Balance */}
                            <td className="py-3 px-4 text-right font-medium">
                              {!startDate ? (
                                <span className="text-muted-foreground">৳0</span>
                              ) : isPrevNeg ? (
                                <span className="inline-flex items-center gap-1 text-destructive font-semibold text-xs">
                                  <AlertCircle className="h-3 w-3" />
                                  বকেয়া {formatBDT(m.previous_balance)}
                                </span>
                              ) : m.previous_balance > 0 ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                                  <TrendingUp className="h-3 w-3" />
                                  জমা +{formatBDT(m.previous_balance)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">৳0</span>
                              )}
                            </td>

                            {/* Period Meals */}
                            <td className="py-3 px-4 text-center">
                              <span className="font-bold text-foreground">{m.period_meals}</span>
                              <span className="text-[10px] text-muted-foreground block">
                                ({m.period_lunch}L / {m.period_dinner}D)
                              </span>
                            </td>

                            {/* Period Meal Cost */}
                            <td className="py-3 px-4 text-right font-medium text-foreground">
                              {formatBDT(m.period_cost)}
                            </td>

                            {/* Period Deposits */}
                            <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              +{formatBDT(m.period_deposit)}
                            </td>

                            {/* Closing Net Balance */}
                            <td className="py-3 px-4 text-right">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                  isCloseNeg
                                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                }`}
                              >
                                {isCloseNeg ? (
                                  <>
                                    <AlertCircle className="h-3 w-3" />
                                    বকেয়া {formatBDT(m.closing_balance)}
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3 w-3" />
                                    উদ্বৃত্ত +{formatBDT(m.closing_balance)}
                                  </>
                                )}
                              </span>
                            </td>

                            {/* Action */}
                            <td className="py-3 px-4 text-center">
                              <Link href={`/deposits?member=${m.member_id}`}>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] gap-1">
                                  <span>Deposit</span>
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile & Small Tablet Card View */}
                <div className="lg:hidden space-y-3">
                  {filteredMembers.map((m) => {
                    const avatarColor = getAvatarColor(m.member_name);
                    const initials = getInitials(m.member_name);
                    const isPrevNeg = m.previous_balance < 0;
                    const isCloseNeg = m.closing_balance < 0;

                    return (
                      <div
                        key={m.member_id}
                        className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-3"
                      >
                        {/* Member Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`h-9 w-9 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor}`}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground text-sm truncate block">
                                {m.member_name}
                              </span>
                              <Badge
                                variant={m.status === "active" ? "success" : "secondary"}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {m.status}
                              </Badge>
                            </div>
                          </div>

                          {/* Closing Balance Badge */}
                          <div className="text-right shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                isCloseNeg
                                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                              }`}
                            >
                              {isCloseNeg ? "বকেয়া: " : "উদ্বৃত্ত: "}
                              {formatBDT(m.closing_balance)}
                            </span>
                          </div>
                        </div>

                        {/* Statement 3-Row Breakdown */}
                        <div className="p-2.5 rounded-lg bg-muted/40 text-xs border border-border/50 space-y-2">
                          {/* Previous / Opening */}
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>
                              আগের বকেয়া / জমা{" "}
                              {startDate && (
                                <span className="text-[10px]">(&lt; {formatDate(startDate)})</span>
                              )}
                            </span>
                            <span
                              className={`font-semibold ${
                                isPrevNeg
                                  ? "text-destructive"
                                  : m.previous_balance > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-foreground"
                              }`}
                            >
                              {!startDate ? "৳0" : formatBDT(m.previous_balance)}
                            </span>
                          </div>

                          {/* Period Updates */}
                          <div className="flex items-center justify-between pt-1 border-t border-border/40">
                            <span>
                              নতুন মিল ({m.period_meals} meals)
                            </span>
                            <span className="font-semibold text-foreground">
                              {formatBDT(m.period_cost)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span>নতুন জমা (Deposits)</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              +{formatBDT(m.period_deposit)}
                            </span>
                          </div>
                        </div>

                        {/* Quick Footer Action */}
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="text-[11px] text-muted-foreground">
                            {m.period_lunch} Lunch • {m.period_dinner} Dinner
                          </span>
                          <Link href={`/deposits?member=${m.member_id}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-primary">
                              <span>Add Deposit</span>
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          ) : (
            // =========================================================================
            // TAB 2: DAILY LEDGER LOGS (Date, Lunch, Dinner, Cost, Members Ate)
            // =========================================================================
            report?.dailyRows.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No daily meal entries recorded in this selected period.
              </div>
            ) : (
              <>
                {/* Desktop View */}
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
                      {report?.dailyRows.map((row) => (
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

                {/* Mobile View */}
                <div className="md:hidden space-y-2.5">
                  {report?.dailyRows.map((row) => (
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
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
