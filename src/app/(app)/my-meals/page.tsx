import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, getMemberPersonalStatement } from "@/lib/services";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { UtensilsCrossed } from "lucide-react";
import { formatDate, formatBDT } from "@/lib/date";

export default async function MyMealsPage() {
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
        title="Personal Meal Attendance History"
        description="Detailed record of all daily lunch and dinner meals logged for your account"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <span className="text-xs text-muted-foreground">Total Meals</span>
            <div className="text-2xl font-bold text-foreground mt-1">
              {statement.summary.total_meals}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <span className="text-xs text-muted-foreground">Lunch Meals</span>
            <div className="text-2xl font-bold text-foreground mt-1">
              {statement.summary.total_lunch}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <span className="text-xs text-muted-foreground">Dinner Meals</span>
            <div className="text-2xl font-bold text-foreground mt-1">
              {statement.summary.total_dinner}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-primary" />
            <span>Daily Meal Logs</span>
          </CardTitle>
          <CardDescription>
            Chronological breakdown with unit rate applied on each date
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statement.dailyMeals.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No meal records found.
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
                  {statement.dailyMeals.map((row) => (
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
    </div>
  );
}
