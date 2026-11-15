"use client";

import * as React from "react";
import {
  Download,
  Wallet,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDailyLedger, getGroupSummary } from "@/lib/services";
import { formatBDT, formatDate } from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import { DailyLedgerRow } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function TotalMillLedgerPage() {
  const [ledgerRows, setLedgerRows] = React.useState<DailyLedgerRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Group summary metrics
  const [totalDeposits, setTotalDeposits] = React.useState(0);
  const [totalExpenses, setTotalExpenses] = React.useState(0);
  const [groupBalance, setGroupBalance] = React.useState(0);
  const [totalMealsServed, setTotalMealsServed] = React.useState(0);

  // Date filters
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  React.useEffect(() => {
    async function fetchLedger() {
      try {
        const supabase = createClient();
        const [ledgerData, summaryData] = await Promise.all([
          getDailyLedger(supabase, startDate || undefined, endDate || undefined),
          getGroupSummary(supabase),
        ]);

        setLedgerRows(ledgerData);
        setTotalDeposits(summaryData.total_group_deposit);
        setTotalExpenses(summaryData.total_group_expense);
        setGroupBalance(summaryData.remaining_group_balance);

        const totalMeals = ledgerData.reduce((acc, row) => acc + row.total_meals, 0);
        setTotalMealsServed(totalMeals);
      } catch (err: unknown) {
        toast.error("Failed to load ledger: " + (err instanceof Error ? err.message : ""));
      } finally {
        setIsLoading(false);
      }
    }

    fetchLedger();
  }, [startDate, endDate]);

  // Export CSV
  const handleExportCSV = () => {
    if (ledgerRows.length === 0) {
      toast.info("No ledger entries to export.");
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

    const rows = ledgerRows.map((r) => [
      r.meal_date,
      r.day_name,
      r.is_friday ? "Yes" : "No",
      r.lunch_count,
      r.dinner_count,
      r.total_meals,
      r.total_cost,
      r.active_members_ate,
    ]);

    downloadCSV("group-mill-ledger", headers, rows);
    toast.success("Ledger exported to CSV successfully.");
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Total Mill Ledger"
        description="Comprehensive group financial account and daily meal consumption records."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
        }
      />

      {/* Top Group Financial Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase truncate">
                Total Deposits
              </p>
              <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                {formatBDT(totalDeposits)}
              </p>
            </div>
            <div className="p-2 sm:p-2.5 bg-emerald-500/10 text-emerald-600 rounded-lg shrink-0">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase truncate">
                Total Meal Expense
              </p>
              <p className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 truncate">
                {formatBDT(totalExpenses)}
              </p>
            </div>
            <div className="p-2 sm:p-2.5 bg-rose-500/10 text-rose-600 rounded-lg shrink-0">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase truncate">
                Remaining Balance
              </p>
              <p
                className={`text-lg sm:text-xl font-bold mt-1 truncate ${
                  groupBalance >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {formatBDT(groupBalance)}
              </p>
            </div>
            <div
              className={`p-2 sm:p-2.5 rounded-lg shrink-0 ${
                groupBalance >= 0
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <Wallet className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase truncate">
                Meals Served
              </p>
              <p className="text-lg sm:text-xl font-bold text-primary mt-1 truncate">
                {totalMealsServed} <span className="text-xs font-normal text-muted-foreground">meals</span>
              </p>
            </div>
            <div className="p-2 sm:p-2.5 bg-primary/10 text-primary rounded-lg shrink-0">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="space-y-1 flex-1 sm:flex-initial">
              <Label htmlFor="start-date" className="text-xs">From Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs w-full sm:w-auto"
              />
            </div>
            <div className="space-y-1 flex-1 sm:flex-initial">
              <Label htmlFor="end-date" className="text-xs">To Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs w-full sm:w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 text-xs w-full sm:w-auto">
                Clear Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Ledger Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">
            Daily Ledger Logs ({ledgerRows.length} Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading ledger data...
            </div>
          ) : ledgerRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No daily meal entries found in this period.
            </div>
          ) : (
            <>
              {/* Desktop / Tablet View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Weekday</th>
                      <th className="py-3 px-4 text-center">Lunch</th>
                      <th className="py-3 px-4 text-center">Dinner</th>
                      <th className="py-3 px-4 text-center">Total Meals</th>
                      <th className="py-3 px-4 text-right">Daily Cost</th>
                      <th className="py-3 px-4 text-right">Members Ate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ledgerRows.map((row) => (
                      <tr key={row.meal_date} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">
                          {formatDate(row.meal_date)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{row.day_name}</span>
                            {row.is_friday && (
                              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-400">
                                Friday
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">{row.lunch_count}</td>
                        <td className="py-3 px-4 text-center">{row.dinner_count}</td>
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

              {/* Mobile Phone Cards */}
              <div className="md:hidden space-y-2.5">
                {ledgerRows.map((row) => (
                  <div
                    key={row.meal_date}
                    className="p-3.5 rounded-xl border border-border bg-card/60 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          {formatDate(row.meal_date)}
                        </span>
                        <span className="text-xs text-muted-foreground">({row.day_name})</span>
                        {row.is_friday && (
                          <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-700 dark:text-amber-400">
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
                      {row.active_members_ate} members ate
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
