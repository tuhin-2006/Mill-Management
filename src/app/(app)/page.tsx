import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import {
  getDashboardData,
  getCurrentUserProfile,
  getMemberPersonalStatement,
  getGroupAggregateLedger,
} from "@/lib/services";
import { Deposit, MealEntry, GroupSummary } from "@/types";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";
import { GroupLedgerViewerDashboard } from "@/components/dashboard/viewer-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  // Role-Based Dashboard Resolution (resolved with 0 duplicate network calls)
  const profile = await getCurrentUserProfile(supabase, user);

  if (profile?.role === "member") {
    let statement = null;
    if (profile.member_id) {
      statement = await getMemberPersonalStatement(supabase, profile.member_id);
    }
    if (statement) {
      return <MemberDashboard initialData={statement} />;
    }
  }

  if (profile?.role === "group_ledger_viewer") {
    const aggregateReport = await getGroupAggregateLedger(supabase);
    return <GroupLedgerViewerDashboard initialReport={aggregateReport} />;
  }

  let summary: GroupSummary;
  let recentDeposits: Deposit[] = [];
  let todayMeals: MealEntry[] = [];
  let isTableMissing = false;

  try {
    const data = await getDashboardData(supabase);
    summary = data.summary;
    recentDeposits = data.recentDeposits;
    todayMeals = data.todayMeals;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("does not exist") || msg.includes("PGRST205") || msg.includes("schema cache")) {
      isTableMissing = true;
    }
    summary = {
      today_date: new Date().toISOString().split("T")[0],
      today_total_meals: 0,
      today_total_cost: 0,
      today_lunch_count: 0,
      today_dinner_count: 0,
      total_group_deposit: 0,
      total_group_expense: 0,
      remaining_group_balance: 0,
      active_members_count: 0,
      total_members_count: 0,
      member_summaries: [],
    };
  }

  return (
    <AdminDashboard
      initialSummary={summary}
      initialRecentDeposits={recentDeposits}
      initialTodayMeals={todayMeals}
      isTableMissing={isTableMissing}
    />
  );
}
