"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Download,
  Calendar,
  Filter,
  RotateCcw,
  UtensilsCrossed,
  TrendingUp,
  Receipt,
  Wallet,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  User,
  Users,
  Search,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPeriodLedgerReport, getCachedItem } from "@/lib/services";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import {
  formatBDT,
  formatDate,
  formatFullDate,
  formatDateTime,
  getPresetDateRange,
  getWeekdayName,
  isFridayDate,
  DatePreset,
} from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import {
  PeriodLedgerReport,
  DailyLedgerRow,
  PeriodPaymentRecord,
  DateGroupedPayment,
  PeriodMemberStatement,
  Member,
} from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type LedgerTab = "daily" | "payments" | "members";

export default function TotalMillLedgerPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-20 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading meal ledger...</span>
        </div>
      }
    >
      <LedgerPageContent />
    </React.Suspense>
  );
}

function LedgerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMember = searchParams?.get("member") || "all";
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>(initialMember);

  React.useEffect(() => {
    const memberParam = searchParams?.get("member");
    if (memberParam && memberParam !== selectedMemberId) {
      setSelectedMemberId(memberParam);
    }
  }, [searchParams, selectedMemberId]);

  const defaultRange = React.useMemo(() => getPresetDateRange("this_month"), []);
  const [activePreset, setActivePreset] = React.useState<DatePreset | "custom">("this_month");
  const [startDate, setStartDate] = React.useState(defaultRange.startDate);
  const [endDate, setEndDate] = React.useState(defaultRange.endDate);

  const [activeTab, setActiveTab] = React.useState<LedgerTab>("daily");
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(new Set());
  const [paymentSearch, setPaymentSearch] = React.useState("");
  const [paymentViewMode, setPaymentViewMode] = React.useState<"grouped" | "individual">("grouped");

  const [report, setReport] = React.useState<PeriodLedgerReport | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchLedger = React.useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        const cacheKey = `period_ledger:${startDate}:${endDate}:${selectedMemberId || "all"}`;
        const cached = getCachedItem<PeriodLedgerReport>(cacheKey);
        if (cached) {
          setReport(cached);
        } else {
          setIsLoading(true);
        }
      }
      const supabase = createClient();
      const data = await getPeriodLedgerReport(supabase, startDate, endDate, selectedMemberId);
      setReport(data);
    } catch (err: unknown) {
      toast.error("Failed to load ledger: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedMemberId]);

  React.useEffect(() => {
    void fetchLedger(true);
  }, [fetchLedger]);

  // Real-time synchronization
  useRealtimeSync(["meals", "deposits", "all"], () => {
    void fetchLedger(false);
  });

  const handleMemberChange = (memberId: string) => {
    setSelectedMemberId(memberId);
    if (memberId === "all") {
      router.replace("/ledger");
    } else {
      router.replace(`/ledger?member=${memberId}`);
    }
  };

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

  const toggleDateExpanded = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  // Export Daily Ledger CSV
  const handleExportDailyCSV = () => {
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
      "Daily Meal Cost (BDT)",
      "Daily Payments (BDT)",
      "Members Ate",
      "Previous Balance (BDT)",
      "Running Balance (BDT)",
    ];

    const rows = report.dailyRows.map((r) => [
      r.meal_date,
      r.day_name,
      r.is_friday ? "Yes" : "No",
      r.lunch_count,
      r.dinner_count,
      r.total_meals,
      r.total_cost,
      r.daily_deposit ?? 0,
      r.active_members_ate,
      r.previous_day_balance ?? 0,
      r.running_balance ?? 0,
    ]);

    const rangeLabel = startDate ? `${startDate}_to_${endDate || "current"}` : "all_records";
    downloadCSV(`daily_running_ledger_${rangeLabel}`, headers, rows);
    toast.success("Daily running ledger exported to CSV successfully.");
  };

  // Export Payments CSV
  const handleExportPaymentsCSV = () => {
    const payments = report?.paymentTransactions || [];
    if (payments.length === 0) {
      toast.info("No payment transactions to export for this period.");
      return;
    }

    const headers = [
      "Payment Date",
      "Member Name",
      "Amount (BDT)",
      "Note / Details",
      "Recorded Timestamp",
    ];

    const rows = payments.map((p) => [
      p.deposit_date,
      p.member_name,
      p.amount,
      p.note || "Regular Mess Deposit",
      p.created_at || "",
    ]);

    const rangeLabel = startDate ? `${startDate}_to_${endDate || "current"}` : "all_records";
    downloadCSV(`payment_details_${rangeLabel}`, headers, rows);
    toast.success("Payment details exported to CSV successfully.");
  };

  // Filtered Payments
  const filteredPayments = React.useMemo(() => {
    const list = report?.paymentTransactions || [];
    if (!paymentSearch.trim()) return list;
    const q = paymentSearch.toLowerCase();
    return list.filter(
      (p) =>
        p.member_name.toLowerCase().includes(q) ||
        (p.note && p.note.toLowerCase().includes(q)) ||
        p.deposit_date.includes(q)
    );
  }, [report?.paymentTransactions, paymentSearch]);

  // Date-wise Aggregated Payments (Calculated dynamically so it obeys search and filters)
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

  const isPreviousDue = (report?.opening.balance ?? 0) < 0;
  const isClosingPositive = (report?.closing.balance ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={
          report?.selectedMemberName
            ? `${report.selectedMemberName} — Meal Ledger`
            : "Total Mill Ledger"
        }
        description={
          report?.selectedMemberName
            ? `Daily meal attendance, previous & running balance progression, and deposit records for ${report.selectedMemberName}.`
            : "Daily meal accounting, previous & running balance calculation, and dedicated payment logs."
        }
        actions={
          <div className="flex items-center gap-2">
            {report?.selectedMemberName && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMemberChange("all")}
                className="gap-1.5 h-9 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>All Members View</span>
              </Button>
            )}
            {activeTab === "payments" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPaymentsCSV}
                className="gap-2 h-9 text-xs"
              >
                <Download className="h-4 w-4" />
                <span>Export Payments CSV</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportDailyCSV}
                className="gap-2 h-9 text-xs"
              >
                <Download className="h-4 w-4" />
                <span>Export Daily Ledger CSV</span>
              </Button>
            )}
          </div>
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

          {/* Custom Date Pickers & Member Filter */}
          <div className="pt-2 border-t border-border/60 flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[130px]">
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
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[130px]">
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

            {/* Member Ledger Filter Dropdown */}
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[190px]">
              <Label htmlFor="member-filter" className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>Member Ledger Filter</span>
              </Label>
              <select
                id="member-filter"
                value={selectedMemberId}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              >
                <option value="all">👥 All Members (Total Mess)</option>
                {(report?.allMembers || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    👤 {m.name} {m.status === "inactive" ? "(Inactive)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToAll}
                className="h-9 text-xs gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Dates</span>
              </Button>

              {selectedMemberId !== "all" && report?.selectedMemberName && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleMemberChange("all")}
                  className="h-9 text-xs gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Viewing: {report.selectedMemberName}</span>
                </Button>
              )}
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
              Period net: {formatBDT(report?.period.net_flow ?? 0)} ({report?.paymentTransactions?.length ?? 0} payments)
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

      {/* Navigation Tabs for Views */}
      <div className="flex border-b border-border gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("daily")}
          className={`pb-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "daily"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UtensilsCrossed className="h-4 w-4" />
          <span>Daily Running Ledger</span>
          {report && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {report.dailyRows.length} Days
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`pb-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "payments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Payment Details</span>
          {report?.paymentTransactions && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {report.paymentTransactions.length} Paid
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`pb-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "members"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" />
          <span>Member Statements</span>
          {report?.memberStatements && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {report.memberStatements.length} Members
            </Badge>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: DAILY RUNNING LEDGER
          ========================================================================= */}
      {activeTab === "daily" && (
        <div className="space-y-6">
          <Card className="border-border shadow-xs">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>
                    {report?.selectedMemberName
                      ? `${report.selectedMemberName} — Daily Session Consumption & Running Balance`
                      : "Daily Session Consumption & Running Balance"}
                  </span>
                </CardTitle>
                <CardDescription>
                  {report?.selectedMemberName
                    ? `Shows each day's previous balance, meal cost added, payments received, and updated running balance for ${report.selectedMemberName}.`
                    : "Shows each day's previous balance, meal cost added, payments received, and updated running balance."}
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
                {/* Desktop & Tablet Table View */}
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
                        <th className="py-3 px-3 text-center font-semibold">Breakdown</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {report.dailyRows.map((row) => {
                        const isExpanded = expandedDates.has(row.meal_date);
                        const hasDeposits = (row.daily_deposit ?? 0) > 0;
                        const prevBal = row.previous_day_balance ?? 0;
                        const runBal = row.running_balance ?? 0;

                        return (
                          <React.Fragment key={row.meal_date}>
                            <tr
                              className={`hover:bg-muted/30 transition-colors ${
                                isExpanded ? "bg-muted/20" : ""
                              }`}
                            >
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
                                  <div className="flex flex-col items-end">
                                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                      +{formatBDT(row.daily_deposit!)}
                                    </span>
                                    {row.daily_deposits_list && row.daily_deposits_list.length > 1 && (
                                      <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                        ({row.daily_deposits_list.length} payments)
                                      </span>
                                    )}
                                  </div>
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

                              <td className="py-3 px-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleDateExpanded(row.meal_date)}
                                  className="h-7 text-[11px] gap-1 px-2"
                                >
                                  <span>{isExpanded ? "Hide" : "Details"}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </td>
                            </tr>

                            {/* Expanded Details Row */}
                            {isExpanded && (
                              <tr className="bg-muted/15 border-b border-border/80">
                                <td colSpan={9} className="p-3.5">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Member Attendance Breakdown */}
                                    <div className="space-y-1.5 p-3 rounded-lg bg-card border border-border/60">
                                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-1 border-b border-border/40">
                                        <span className="flex items-center gap-1">
                                          <UtensilsCrossed className="h-3 w-3 text-primary" />
                                          <span>Member Meal Attendance ({row.active_members_ate} ate)</span>
                                        </span>
                                        <span>Cost Added</span>
                                      </div>
                                      {row.member_meals && row.member_meals.length > 0 ? (
                                        <div className="divide-y divide-border/30">
                                          {row.member_meals.map((mm) => (
                                            <div
                                              key={mm.member_id}
                                              className="flex items-center justify-between py-1 text-xs"
                                            >
                                              <span className="font-medium text-foreground">
                                                {mm.member_name}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <span className="text-[11px] text-muted-foreground">
                                                  L:{mm.lunch} D:{mm.dinner} ({mm.total_meals} meals)
                                                </span>
                                                <span className="font-bold text-foreground">
                                                  {formatBDT(mm.cost)}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-muted-foreground py-1">
                                          No individual meals recorded.
                                        </div>
                                      )}
                                    </div>

                                    {/* Payments Received on this Date */}
                                    <div className="space-y-1.5 p-3 rounded-lg bg-card border border-border/60">
                                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-1 border-b border-border/40">
                                        <span className="flex items-center gap-1">
                                          <Wallet className="h-3 w-3 text-emerald-600" />
                                          <span>Payments / Deposits Received on this Day</span>
                                        </span>
                                        <span>Amount</span>
                                      </div>
                                      {row.daily_deposits_list && row.daily_deposits_list.length > 0 ? (
                                        <div className="divide-y divide-border/30">
                                          {row.daily_deposits_list.map((dep) => (
                                            <div
                                              key={dep.id}
                                              className="flex items-center justify-between py-1 text-xs"
                                            >
                                              <div>
                                                <span className="font-medium text-foreground">
                                                  {dep.member_name}
                                                </span>
                                                {dep.note && (
                                                  <span className="text-[10px] text-muted-foreground ml-1.5 italic">
                                                    ({dep.note})
                                                  </span>
                                                )}
                                              </div>
                                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                +{formatBDT(dep.amount)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-muted-foreground py-2 text-center">
                                          No payments received on this date.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile & Tablet Card View */}
                <div className="lg:hidden space-y-3">
                  {report.dailyRows.map((row) => {
                    const isExpanded = expandedDates.has(row.meal_date);
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleDateExpanded(row.meal_date)}
                            className="h-6 text-[11px] gap-1 px-1.5"
                          >
                            <span>{isExpanded ? "Hide" : "Breakdown"}</span>
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                        </div>

                        {/* Mobile Expanded Details */}
                        {isExpanded && (
                          <div className="pt-2 border-t border-border/60 space-y-2">
                            {/* Member Attendance */}
                            <div className="space-y-1">
                              <span className="text-[11px] font-semibold text-muted-foreground block">
                                Member Attendance ({row.active_members_ate} members ate):
                              </span>
                              {row.member_meals?.map((mm) => (
                                <div
                                  key={mm.member_id}
                                  className="flex items-center justify-between text-xs py-0.5"
                                >
                                  <span>{mm.member_name}</span>
                                  <span className="text-muted-foreground">
                                    L:{mm.lunch} D:{mm.dinner} • {formatBDT(mm.cost)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Deposits */}
                            {hasDeposits && (
                              <div className="pt-1.5 border-t border-border/40 space-y-1">
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                                  Payments on this Date:
                                </span>
                                {row.daily_deposits_list?.map((d) => (
                                  <div
                                    key={d.id}
                                    className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 py-0.5"
                                  >
                                    <span>
                                      {d.member_name} {d.note && `(${d.note})`}
                                    </span>
                                    <span className="font-bold">+{formatBDT(d.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* =========================================================================
            DEDICATED PAYMENT & DEPOSIT HISTORY (কবে payment করা হয়েছে - Organized by Date)
            ========================================================================= */}
        <Card className="border-border shadow-xs">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {report?.selectedMemberName
                    ? `${report.selectedMemberName}'s Payment & Deposit Records (জমা বিবরণী)`
                    : "Payment & Deposit History (পেমেন্ট হিস্ট্রি - কবে টাকা জমা দেওয়া হয়েছে)"}
                </span>
              </CardTitle>
              <CardDescription>
                {report?.selectedMemberName
                  ? `Chronological record of all payments and deposits received from ${report.selectedMemberName}, organized by date.`
                  : "Chronological audit of deposits received: payment date, depositor name, remarks, and exact amount credited."}
              </CardDescription>
            </div>

            {/* Payment Search, Mode Switcher & Count Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search note or member..."
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
                <span>Loading payment history...</span>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30 text-emerald-600" />
                <p className="font-medium text-foreground">No payment records found for this selected period.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Payments recorded via Deposits will automatically organize here by date.
                </p>
              </div>
            ) : paymentViewMode === "grouped" ? (
              /* =========================================================
                 VIEW 1: DATE-WISE GROUPED PAYMENTS (তারিখভিত্তিক মোট জমা)
                 Sums up all payments per date & shows contributor breakdown
                 ========================================================= */
              <div className="space-y-3">
                {/* Desktop & Tablet Grouped Table */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-3 px-3.5 font-semibold">Payment Date</th>
                        <th className="py-3 px-3.5 text-right font-semibold">Total Paid on Date (মোট জমা)</th>
                        <th className="py-3 px-3.5 font-semibold">Contributors & Breakdown (কার কত টাকা জমা)</th>
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
                              {grp.payment_count} {grp.payment_count > 1 ? "deposits received" : "deposit"}
                            </span>
                          </td>

                          <td className="py-3.5 px-3.5 text-right whitespace-nowrap align-top">
                            <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-sm">
                              +{formatBDT(grp.total_amount)}
                            </span>
                            {grp.payments.length > 1 && (
                              <span className="text-[10px] text-muted-foreground block mt-0.5">
                                {grp.payments.length} জনের সর্বমোট
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3.5 align-top">
                            <div className="flex flex-wrap gap-2">
                              {grp.payments.map((p) => (
                                <div
                                  key={p.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/60 text-xs shadow-2xs"
                                >
                                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                                    {p.member_name.slice(0, 2).toUpperCase()}
                                  </span>
                                  <span className="font-semibold text-foreground">{p.member_name}</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    +{formatBDT(p.amount)}
                                  </span>
                                  {p.note && (
                                    <span
                                      className="text-[10px] text-muted-foreground italic truncate max-w-[150px]"
                                      title={p.note}
                                    >
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
                                  {grp.payments.length > 1 && (
                                    <span className="text-muted-foreground text-[10px]">{p.member_name}: </span>
                                  )}
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

                {/* Mobile Phone Grouped Card View */}
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
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block tracking-wider">
                          Contributors ({grp.payment_count} {grp.payment_count > 1 ? "payments" : "payment"}):
                        </span>
                        {grp.payments.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-muted/40 border border-border/30"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                                {p.member_name.slice(0, 2).toUpperCase()}
                              </span>
                              <div className="truncate">
                                <span className="font-semibold text-foreground block truncate">{p.member_name}</span>
                                {p.note && (
                                  <span className="text-[10px] text-muted-foreground italic block truncate">
                                    {p.note}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block">
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
                 Detailed line-by-line audit table
                 ========================================================= */
              <div className="space-y-3">
                {/* Desktop & Tablet Table */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-3 px-3.5 font-semibold">Payment Date</th>
                        <th className="py-3 px-3.5 font-semibold">Depositor</th>
                        <th className="py-3 px-3.5 font-semibold">Note / Payment Method</th>
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

                          <td className="py-3 px-3.5 font-semibold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                {p.member_name.slice(0, 2).toUpperCase()}
                              </span>
                              <span>{p.member_name}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3.5 text-muted-foreground">
                            <span className="inline-block max-w-[280px] truncate" title={p.note || "Regular Mess Deposit"}>
                              {p.note || "Regular Mess Deposit"}
                            </span>
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
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">
                            {p.member_name.slice(0, 2).toUpperCase()}
                          </span>
                          <span>{p.member_name}</span>
                        </span>
                        <span className="text-[11px] text-muted-foreground italic truncate max-w-[150px]">
                          {p.note || "Regular Deposit"}
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
    )}

      {/* =========================================================================
          TAB 2: PAYMENT & DEPOSIT DETAILS (কবে payment করা হয়েছে)
          ========================================================================= */}
      {activeTab === "payments" && (
        <Card className="border-border shadow-xs">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Payment & Deposit Transaction History</span>
              </CardTitle>
              <CardDescription>
                Detailed audit of who paid, on which date, amount deposited, and payment remarks.
              </CardDescription>
            </div>

            {/* Payment Search, Mode Switcher & Count */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search member or note..."
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
              <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Loading payment records...</span>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No payment transactions found matching the filter or date range.
              </div>
            ) : paymentViewMode === "grouped" ? (
              <div className="space-y-3">
                {/* Desktop & Tablet Grouped Table */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-3 px-3.5 font-semibold">Payment Date</th>
                        <th className="py-3 px-3.5 text-right font-semibold">Total Paid on Date (মোট জমা)</th>
                        <th className="py-3 px-3.5 font-semibold">Contributors & Breakdown (কার কত টাকা জমা)</th>
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
                              {grp.payment_count} {grp.payment_count > 1 ? "deposits received" : "deposit"}
                            </span>
                          </td>

                          <td className="py-3.5 px-3.5 text-right whitespace-nowrap align-top">
                            <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-sm">
                              +{formatBDT(grp.total_amount)}
                            </span>
                            {grp.payments.length > 1 && (
                              <span className="text-[10px] text-muted-foreground block mt-0.5">
                                {grp.payments.length} জনের সর্বমোট
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3.5 align-top">
                            <div className="flex flex-wrap gap-2">
                              {grp.payments.map((p) => (
                                <div
                                  key={p.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/60 text-xs shadow-2xs"
                                >
                                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                                    {p.member_name.slice(0, 2).toUpperCase()}
                                  </span>
                                  <span className="font-semibold text-foreground">{p.member_name}</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    +{formatBDT(p.amount)}
                                  </span>
                                  {p.note && (
                                    <span
                                      className="text-[10px] text-muted-foreground italic truncate max-w-[150px]"
                                      title={p.note}
                                    >
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
                                  {grp.payments.length > 1 && (
                                    <span className="text-muted-foreground text-[10px]">{p.member_name}: </span>
                                  )}
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

                {/* Mobile Phone Grouped Card View */}
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
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block tracking-wider">
                          Contributors ({grp.payment_count} {grp.payment_count > 1 ? "payments" : "payment"}):
                        </span>
                        {grp.payments.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-muted/40 border border-border/30"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                                {p.member_name.slice(0, 2).toUpperCase()}
                              </span>
                              <div className="truncate">
                                <span className="font-semibold text-foreground block truncate">{p.member_name}</span>
                                {p.note && (
                                  <span className="text-[10px] text-muted-foreground italic block truncate">
                                    {p.note}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block">
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
              <div className="space-y-3">
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-3 px-3.5 font-semibold">Payment Date</th>
                        <th className="py-3 px-3.5 font-semibold">Member</th>
                        <th className="py-3 px-3.5 font-semibold">Payment Note / Method</th>
                        <th className="py-3 px-3.5 text-right font-semibold">Amount (BDT)</th>
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

                          <td className="py-3 px-3.5 font-semibold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                {p.member_name.slice(0, 2).toUpperCase()}
                              </span>
                              <span>{p.member_name}</span>
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
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">
                            {p.member_name.slice(0, 2).toUpperCase()}
                          </span>
                          <span>{p.member_name}</span>
                        </span>
                        <span className="text-[11px] text-muted-foreground italic truncate max-w-[150px]">
                          {p.note || "Regular Deposit"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* =========================================================================
          TAB 3: MEMBER BALANCE RECONCILIATION SUMMARY
          ========================================================================= */}
      {activeTab === "members" && (
        <Card className="border-border shadow-xs">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <span>Member Account Balance Reconciliation</span>
              </CardTitle>
              <CardDescription>
                Full period breakdown: Previous Balance (B/F) + Deposits - Meal Cost = Closing Net Balance.
              </CardDescription>
            </div>
            {report?.memberStatements && (
              <Badge variant="outline" className="text-xs self-start sm:self-auto">
                {report.memberStatements.length} Active Members
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Loading member statements...</span>
              </div>
            ) : !report?.memberStatements || report.memberStatements.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No member records found.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Desktop & Tablet Table View */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-3 px-3.5 font-semibold">Member</th>
                        <th className="py-3 px-3.5 text-right font-semibold">Previous Bal (B/F)</th>
                        <th className="py-3 px-3.5 text-center font-semibold">Period Meals</th>
                        <th className="py-3 px-3.5 text-right font-semibold">Meal Expense</th>
                        <th className="py-3 px-3.5 text-right font-semibold">Period Paid</th>
                        <th className="py-3 px-3.5 text-right font-semibold">Period Net</th>
                        <th className="py-3 px-3.5 text-right font-semibold">Closing Balance</th>
                        <th className="py-3 px-3.5 text-center font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {report.memberStatements.map((ms) => {
                        const isClosingPositive = ms.closing_balance >= 0;
                        const isPrevPositive = ms.previous_balance >= 0;

                        return (
                          <tr key={ms.member_id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-3.5 font-bold text-foreground">
                              <div className="flex items-center gap-2">
                                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                  {ms.member_name.slice(0, 2).toUpperCase()}
                                </span>
                                <span>{ms.member_name}</span>
                              </div>
                            </td>

                            <td className="py-3 px-3.5 text-right font-medium">
                              <span
                                className={
                                  isPrevPositive
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }
                              >
                                {formatBDT(ms.previous_balance)}
                              </span>
                            </td>

                            <td className="py-3 px-3.5 text-center">
                              <span className="font-semibold text-foreground">{ms.period_meals}</span>
                              <span className="text-[10px] text-muted-foreground block">
                                (L:{ms.period_lunch} D:{ms.period_dinner})
                              </span>
                            </td>

                            <td className="py-3 px-3.5 text-right font-semibold text-foreground">
                              {formatBDT(ms.period_cost)}
                            </td>

                            <td className="py-3 px-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              +{formatBDT(ms.period_deposit)}
                            </td>

                            <td className="py-3 px-3.5 text-right font-medium">
                              <span
                                className={
                                  ms.period_net >= 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }
                              >
                                {ms.period_net >= 0 ? "+" : ""}
                                {formatBDT(ms.period_net)}
                              </span>
                            </td>

                            <td className="py-3 px-3.5 text-right font-extrabold text-sm">
                              <span
                                className={
                                  isClosingPositive
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }
                              >
                                {formatBDT(ms.closing_balance)}
                              </span>
                            </td>

                            <td className="py-3 px-3.5 text-center">
                              <Badge
                                variant={isClosingPositive ? "success" : "destructive"}
                                className="text-[10px] px-2 py-0.5"
                              >
                                {isClosingPositive ? "Advance" : "Due"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Phone Card View */}
                <div className="sm:hidden space-y-2.5">
                  {report.memberStatements.map((ms) => {
                    const isClosingPositive = ms.closing_balance >= 0;
                    const isPrevPositive = ms.previous_balance >= 0;

                    return (
                      <div
                        key={ms.member_id}
                        className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                              {ms.member_name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="font-bold text-sm text-foreground">{ms.member_name}</span>
                          </div>
                          <Badge
                            variant={isClosingPositive ? "success" : "destructive"}
                            className="text-[10px] px-2 py-0.5"
                          >
                            {isClosingPositive ? "Advance" : "Due"}
                          </Badge>
                        </div>

                        {/* 4-Field Grid Breakdown */}
                        <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-muted/40 text-xs border border-border/30">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Previous Bal (B/F)</span>
                            <span
                              className={`font-semibold ${
                                isPrevPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
                              }`}
                            >
                              {formatBDT(ms.previous_balance)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Period Meals</span>
                            <span className="font-semibold text-foreground">
                              {ms.period_meals} ({formatBDT(ms.period_cost)})
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Period Paid</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              +{formatBDT(ms.period_deposit)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Period Net</span>
                            <span
                              className={`font-semibold ${
                                ms.period_net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
                              }`}
                            >
                              {ms.period_net >= 0 ? "+" : ""}
                              {formatBDT(ms.period_net)}
                            </span>
                          </div>
                        </div>

                        {/* Closing Balance Highlight */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-medium text-muted-foreground">Closing Net Balance</span>
                          <span
                            className={`font-extrabold text-sm ${
                              isClosingPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
                            }`}
                          >
                            {formatBDT(ms.closing_balance)}
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
      )}
    </div>
  );
}
