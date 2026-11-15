"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Receipt, CheckCircle2, Calendar, Filter, RotateCcw, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile, getMemberPersonalStatement } from "@/lib/services";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatBDT, getPresetDateRange, DatePreset } from "@/lib/date";
import { MemberPersonalStatement } from "@/types";
import { toast } from "sonner";

export default function MyStatementPage() {
  const router = useRouter();
  const [statement, setStatement] = React.useState<MemberPersonalStatement | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [memberId, setMemberId] = React.useState<string | null>(null);

  const [activePreset, setActivePreset] = React.useState<DatePreset | "custom">("all");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

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
          toast.error("Failed to load statement: " + (err instanceof Error ? err.message : ""));
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

  const summary = statement?.summary;
  const isAdvance = (summary?.balance ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Account Statement & Reconciliation"
        description="Official breakdown of your cumulative meals, total payments, and closing balance"
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
              <Label htmlFor="s-start-date" className="text-[11px] font-semibold text-muted-foreground">
                From Date
              </Label>
              <Input
                id="s-start-date"
                type="date"
                value={startDate}
                onChange={handleCustomStartDate}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1 flex-1 sm:flex-initial min-w-[140px]">
              <Label htmlFor="s-end-date" className="text-[11px] font-semibold text-muted-foreground">
                To Date
              </Label>
              <Input
                id="s-end-date"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={`border-2 ${isAdvance ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <span>Statement Summary</span>
            </CardTitle>
            <CardDescription>
              Account calculation formula and status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Calculating statement...</span>
              </div>
            ) : summary ? (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-muted-foreground">Lifetime Deposited:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatBDT(summary.total_deposited)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-muted-foreground">Period Deposited:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatBDT(summary.period_deposited ?? summary.total_deposited)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-muted-foreground">Period Meal Cost:</span>
                    <span className="font-semibold text-foreground">{formatBDT(summary.total_meal_cost)}</span>
                  </div>
                  <div className="flex justify-between py-2 font-bold text-base">
                    <span>Closing Net Balance:</span>
                    <span className={isAdvance ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                      {formatBDT(summary.balance)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-card border border-border text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Reconciliation Guarantee:</strong> Your balance is derived mathematically as
                    <code> Deposited - Meal Cost = Balance</code>. No balance is ever stored independently, eliminating accounting drift.
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meal Breakdown Summary</CardTitle>
            <CardDescription>Aggregate count by session</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Loading meal summary...</span>
              </div>
            ) : summary ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Period Lunch Meals:</span>
                  <span className="font-semibold text-foreground">{summary.total_lunch} meals</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Period Dinner Meals:</span>
                  <span className="font-semibold text-foreground">{summary.total_dinner} meals</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border font-semibold">
                  <span>Total Meals Consumed:</span>
                  <span>{summary.total_meals} meals</span>
                </div>
                <div className="flex justify-between py-1.5 text-xs text-muted-foreground">
                  <span>Average Cost per Meal:</span>
                  <span>
                    {summary.total_meals > 0
                      ? formatBDT(Math.round(summary.total_meal_cost / summary.total_meals))
                      : "৳0"}
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
