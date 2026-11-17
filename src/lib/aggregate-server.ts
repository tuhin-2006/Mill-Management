import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getWeekdayName, isFridayDate } from "@/lib/date";
import { GroupAggregateReport, GroupAggregateDailyRow, GroupDailyPayment } from "@/types";

/**
 * Server-only secure aggregate calculator for Group Ledger Viewer.
 * STRICTLY excludes individual member names, IDs, personal records, and balance breakdowns.
 * Integrates initial member balances (adjustments) into the group running balance.
 */
export async function computeGroupAggregateReport(
  startDate?: string,
  endDate?: string
): Promise<GroupAggregateReport> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL missing from environment.");
  }

  const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [mealsRes, depositsRes, membersRes, adjustmentsRes] = await Promise.all([
    supabaseAdmin.from("meal_entries").select("meal_date, session, quantity, unit_price"),
    supabaseAdmin.from("deposits").select("deposit_date, amount"),
    supabaseAdmin.from("members").select("id, status"),
    supabaseAdmin.from("adjustments").select("adjustment_date, amount"),
  ]);

  const meals = (mealsRes.data || []).map((m) => ({
    ...m,
    quantity: Number(m.quantity) || 0,
    unit_price: Number(m.unit_price) || 0,
  }));
  const deposits = (depositsRes.data || []).map((d) => ({
    ...d,
    amount: Number(d.amount) || 0,
  }));
  const adjustments = (adjustmentsRes.data || []).map((a) => ({
    ...a,
    amount: Number(a.amount) || 0,
  }));

  const activeCount = (membersRes.data || []).filter((m) => m.status === "active").length;

  // Calculate opening balance before startDate
  let openingDeposit = 0;
  let openingCost = 0;
  let openingBalance = 0;
  if (startDate) {
    openingDeposit =
      deposits.filter((d) => d.deposit_date < startDate).reduce((acc, d) => acc + d.amount, 0) +
      adjustments.filter((a) => a.adjustment_date < startDate).reduce((acc, a) => acc + a.amount, 0);
    openingCost = meals
      .filter((m) => m.meal_date < startDate)
      .reduce((acc, m) => acc + (m.quantity > 0 ? m.quantity * m.unit_price : 0), 0);
    openingBalance = openingDeposit - openingCost;
  }

  const datesMap = new Map<
    string,
    {
      lunch_count: number;
      dinner_count: number;
      total_meals: number;
      total_cost: number;
      total_deposit: number;
      deposit_count: number;
    }
  >();

  // Aggregate meal entries by date
  for (const m of meals) {
    if (startDate && m.meal_date < startDate) continue;
    if (endDate && m.meal_date > endDate) continue;
    if (m.quantity <= 0) continue;

    const row = datesMap.get(m.meal_date) || {
      lunch_count: 0,
      dinner_count: 0,
      total_meals: 0,
      total_cost: 0,
      total_deposit: 0,
      deposit_count: 0,
    };
    if (m.session === "lunch") row.lunch_count += m.quantity;
    if (m.session === "dinner") row.dinner_count += m.quantity;
    row.total_meals += m.quantity;
    row.total_cost += m.quantity * m.unit_price;
    datesMap.set(m.meal_date, row);
  }

  // Aggregate deposits by date
  for (const d of deposits) {
    if (startDate && d.deposit_date < startDate) continue;
    if (endDate && d.deposit_date > endDate) continue;

    const row = datesMap.get(d.deposit_date) || {
      lunch_count: 0,
      dinner_count: 0,
      total_meals: 0,
      total_cost: 0,
      total_deposit: 0,
      deposit_count: 0,
    };
    row.total_deposit += d.amount;
    row.deposit_count += 1;
    datesMap.set(d.deposit_date, row);
  }

  // Aggregate adjustments (including initial balances on 15 Nov 2026) by date
  for (const a of adjustments) {
    if (startDate && a.adjustment_date < startDate) continue;
    if (endDate && a.adjustment_date > endDate) continue;

    const row = datesMap.get(a.adjustment_date) || {
      lunch_count: 0,
      dinner_count: 0,
      total_meals: 0,
      total_cost: 0,
      total_deposit: 0,
      deposit_count: 0,
    };
    row.total_deposit += a.amount;
    row.deposit_count += 1;
    datesMap.set(a.adjustment_date, row);
  }

  // Chronological progression for running balance calculation (oldest to newest)
  const sortedAsc = Array.from(datesMap.entries())
    .map(([date, d]) => ({
      meal_date: date,
      day_name: getWeekdayName(date),
      is_friday: isFridayDate(date),
      lunch_count: d.lunch_count,
      dinner_count: d.dinner_count,
      total_meals: d.total_meals,
      total_cost: d.total_cost,
      total_deposit: d.total_deposit,
      deposit_count: d.deposit_count,
      previous_day_balance: 0,
      running_balance: 0,
    }))
    .sort((a, b) => a.meal_date.localeCompare(b.meal_date));

  let currentRunning = openingBalance;
  for (const row of sortedAsc) {
    row.previous_day_balance = currentRunning;
    currentRunning = currentRunning + row.total_deposit - row.total_cost;
    row.running_balance = currentRunning;
  }

  // Reverse so newest records appear first for display
  const daily_rows: GroupAggregateDailyRow[] = sortedAsc.reverse();

  // Aggregate payments by date (STRICTLY excludes member names and private notes)
  const daily_payments: GroupDailyPayment[] = daily_rows
    .filter((r) => r.total_deposit !== 0)
    .map((r) => ({
      deposit_date: r.meal_date,
      day_name: r.day_name,
      is_friday: r.is_friday,
      total_amount: r.total_deposit,
      deposit_count: (r as { deposit_count?: number }).deposit_count || 1,
    }))
    .sort((a, b) => b.deposit_date.localeCompare(a.deposit_date));

  const totalPeriodMeals = daily_rows.reduce((acc, r) => acc + r.total_meals, 0);
  const totalPeriodLunch = daily_rows.reduce((acc, r) => acc + r.lunch_count, 0);
  const totalPeriodDinner = daily_rows.reduce((acc, r) => acc + r.dinner_count, 0);
  const totalPeriodCost = daily_rows.reduce((acc, r) => acc + r.total_cost, 0);
  const totalPeriodDeposit = daily_rows.reduce((acc, r) => acc + r.total_deposit, 0);

  const totalLifetimeDeposits =
    deposits.reduce((acc, d) => acc + d.amount, 0) +
    adjustments.reduce((acc, a) => acc + a.amount, 0);
  const totalLifetimeExpenses = meals.reduce(
    (acc, m) => acc + (m.quantity > 0 ? m.quantity * m.unit_price : 0),
    0
  );

  return {
    opening: {
      total_cost: openingCost,
      total_deposit: openingDeposit,
      balance: openingBalance,
    },
    period: {
      startDate,
      endDate,
      total_meals: totalPeriodMeals,
      total_lunch: totalPeriodLunch,
      total_dinner: totalPeriodDinner,
      total_cost: totalPeriodCost,
      total_deposit: totalPeriodDeposit,
      net_flow: totalPeriodDeposit - totalPeriodCost,
      opening_balance: openingBalance,
      closing_balance: currentRunning,
    },
    closing: {
      total_cost: openingCost + totalPeriodCost,
      total_deposit: openingDeposit + totalPeriodDeposit,
      balance: currentRunning,
    },
    lifetime: {
      total_deposits: totalLifetimeDeposits,
      total_expenses: totalLifetimeExpenses,
      balance: totalLifetimeDeposits - totalLifetimeExpenses,
      active_members_count: activeCount,
    },
    daily_rows,
    daily_payments,
  };
}
