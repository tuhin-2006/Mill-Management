import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, getMemberPersonalStatement } from "@/lib/services";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { formatDate, formatBDT } from "@/lib/date";

export default async function MyDepositsPage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);

  if (!profile || profile.role !== "member" || !profile.member_id) {
    redirect("/");
  }

  const statement = await getMemberPersonalStatement(supabase, profile.member_id);
  if (!statement) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Deposit Ledger"
        description="Verified deposit payments credited towards your mess account balance"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Total Deposited</span>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {formatBDT(statement.summary.total_deposited)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {statement.deposits.length} deposit transaction(s) recorded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Current Net Balance</span>
            <div className={`text-3xl font-extrabold mt-1 ${statement.summary.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {formatBDT(statement.summary.balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {statement.summary.balance >= 0 ? "Advance surplus remaining" : "Outstanding balance due"}
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
          {statement.deposits.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No deposit records logged yet.
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
