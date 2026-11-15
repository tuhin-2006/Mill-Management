"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet, Calendar, Filter, RotateCcw, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile, getMemberPersonalStatement } from "@/lib/services";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatBDT, getPresetDateRange, DatePreset } from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import { MemberPersonalStatement } from "@/types";
import { toast } from "sonner";

export default function MyDepositsPage() {
  const router = useRouter();
  const [statement, setStatement] = React.useState<MemberPersonalStatement | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [memberId, setMemberId] = React.useState<string | null>(null);

  const [activePreset, setActivePreset] = React.useState<DatePreset | "custom">("all");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

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

  // Fetch data on range change
  React.useEffect(() => {
    if (!memberId) return;
    let ignore = false;

    async function loadData() {
      try {
        setIsLoading(true);
        const supabase = createClient();
        const res = await getMemberPersonalStatement(
          supabase,
          memberId!,
          startDate || undefined,
          endDate || undefined
        );
        if (!ignore) {
          setStatement(res);
        }
      } catch (err: unknown) {
        if (!ignore) {
          toast.error("Failed to load deposits: " + (err instanceof Error ? err.message : ""));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      ignore = true;
    };
  }, [memberId, startDate, endDate]);

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
    if (!statement || statement.deposits.length === 0) {
      toast.info("No deposit records to export.");
      return;
    }
    const headers = ["Date", "Note / Details", "Amount (BDT)"];
    const rows = statement.deposits.map((d) => [
      d.deposit_date,
      d.note || "Regular Mess Deposit",
      d.amount.toString(),
    ]);
    downloadCSV(`my_deposits_${startDate || "all"}_to_${endDate || "current"}`, headers, rows);
    toast.success("Deposit records exported to CSV.");
  };

  const periodDeposited = statement?.summary.period_deposited ?? statement?.summary.total_deposited ?? 0;
  const currentBalance = statement?.summary.balance ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Deposit Ledger"
        description="Verified deposit payments credited towards your mess account balance"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5 text-xs h-9"
          >
            <Download className="h-4 w-4" />
            <span>Export Deposits CSV</span>
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
              <Label htmlFor="d-start-date" className="text-[11px] font-semibold text-muted-foreground">
                From Date
              </Label>
              <Input
                id="d-start-date"
                type="date"
                value={startDate}
                onChange={handleCustomStartDate}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[140px]">
              <Label htmlFor="d-end-date" className="text-[11px] font-semibold text-muted-foreground">
                To Date
              </Label>
              <Input
                id="d-end-date"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <span className="text-xs text-muted-foreground uppercase font-semibold">
              Period Deposits (জমা)
            </span>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {formatBDT(periodDeposited)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {statement?.deposits.length ?? 0} deposit transaction(s) recorded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs text-muted-foreground uppercase font-semibold">
              Current Net Balance (বর্তমান ব্যালেন্স)
            </span>
            <div
              className={`text-3xl font-extrabold mt-1 ${
                currentBalance >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatBDT(currentBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentBalance >= 0 ? "Advance surplus remaining" : "Outstanding balance due"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Deposit History</span>
          </CardTitle>
          <CardDescription>
            Chronological records of all payments acknowledged by the administrator
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading deposit records...</span>
            </div>
          ) : !statement || statement.deposits.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No deposit records logged for this selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase text-[10px] font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Note / Details</th>
                    <th className="py-2.5 px-3 text-right">Amount (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {statement.deposits.map((d) => (
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
    </div>
  );
}
