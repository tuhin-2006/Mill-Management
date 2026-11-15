import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, getMemberPersonalStatement } from "@/lib/services";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Receipt, CheckCircle2 } from "lucide-react";
import { formatBDT } from "@/lib/date";

export default async function MyStatementPage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);

  if (!profile || profile.role !== "member" || !profile.member_id) {
    redirect("/");
  }

  const statement = await getMemberPersonalStatement(supabase, profile.member_id);
  if (!statement) {
    redirect("/");
  }

  const summary = statement.summary;
  const isAdvance = summary.balance >= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Account Statement & Reconciliation"
        description="Official breakdown of your cumulative meals, total payments, and closing balance"
      />

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
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Total Lifetime Deposited:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatBDT(summary.total_deposited)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Total Lifetime Meal Cost:</span>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meal Breakdown Summary</CardTitle>
            <CardDescription>Aggregate count by session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Total Lunch Meals:</span>
                <span className="font-semibold text-foreground">{summary.total_lunch} meals</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Total Dinner Meals:</span>
                <span className="font-semibold text-foreground">{summary.total_dinner} meals</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border font-semibold">
                <span>Total Meals Consumed:</span>
                <span>{summary.total_meals} meals</span>
              </div>
              <div className="flex justify-between py-1.5 text-xs text-muted-foreground">
                <span>Average Cost per Meal:</span>
                <span>{summary.total_meals > 0 ? formatBDT(Math.round(summary.total_meal_cost / summary.total_meals)) : "৳0"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
