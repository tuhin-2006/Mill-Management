import { SupabaseClient } from "@supabase/supabase-js";
import {
  Member,
  MealEntry,
  Deposit,
  Settings,
  MemberSummary,
  GroupSummary,
  DailyLedgerRow,
  PeriodLedgerReport,
  PeriodMemberStatement,
} from "@/types";
import { getTodayInDhaka, getWeekdayName, isFridayDate } from "@/lib/date";

// ==============================================================================
// In-Memory Fast Cache (Zero-latency client navigation & instant revalidation)
// ==============================================================================
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheItem<unknown>>();
const DEFAULT_TTL_MS = 25_000; // 25 seconds TTL

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
  } else {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  }
}

function getFromCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > DEFAULT_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return item.data as T;
}

function setToCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  memoryCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Default fallback settings
 */
export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  app_name: "Mill Manager",
  meal_price: 60.0,
  friday_meal_price: 120.0,
  currency: "BDT",
  timezone: "Asia/Dhaka",
  friday_dinner_disabled: true,
  updated_at: new Date().toISOString(),
};

/**
 * 1. Fetch system settings
 */
export async function getSettings(supabase: SupabaseClient): Promise<Settings> {
  const cached = getFromCache<Settings>("settings");
  if (cached) return cached;

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  const result: Settings = {
    ...data,
    meal_price: Number(data.meal_price),
    friday_meal_price: data.friday_meal_price != null ? Number(data.friday_meal_price) : 120.0,
  };

  setToCache("settings", result);
  return result;
}

/**
 * 2. Update system settings
 */
export async function updateSettings(
  supabase: SupabaseClient,
  updates: Partial<Omit<Settings, "id" | "updated_at">>
): Promise<Settings> {
  invalidateCache();
  const res = await supabase
    .from("settings")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select()
    .single();

  let data = res.data;
  const error = res.error;

  // If friday_meal_price column doesn't exist yet in Supabase, retry without it
  if (error && error.message.includes("friday_meal_price")) {
    const fallbackUpdates = { ...updates };
    delete fallbackUpdates.friday_meal_price;
    const retry = await supabase
      .from("settings")
      .update({
        ...fallbackUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select()
      .single();

    if (retry.error) {
      throw new Error(`Failed to update settings: ${retry.error.message}`);
    }
    data = retry.data;
  } else if (error) {
    throw new Error(`Failed to update settings: ${error.message}`);
  }

  const result: Settings = {
    ...data,
    meal_price: Number(data.meal_price),
    friday_meal_price:
      data.friday_meal_price != null
        ? Number(data.friday_meal_price)
        : updates.friday_meal_price != null
        ? Number(updates.friday_meal_price)
        : 120.0,
  };

  setToCache("settings", result);
  return result;
}

/**
 * 3. Fetch all members
 */
export async function getMembers(supabase: SupabaseClient): Promise<Member[]> {
  const cached = getFromCache<Member[]>("members");
  if (cached) return cached;

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  const result = data || [];
  setToCache("members", result);
  return result;
}

/**
 * 4. Add a new member
 */
export async function addMember(
  supabase: SupabaseClient,
  name: string
): Promise<Member> {
  invalidateCache();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Member name cannot be empty.");

  const { data, error } = await supabase
    .from("members")
    .insert({ name: trimmed, status: "active" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add member: ${error.message}`);
  }

  return data;
}

/**
 * 5. Update an existing member (name / status)
 */
export async function updateMember(
  supabase: SupabaseClient,
  id: string,
  updates: { name?: string; status?: "active" | "inactive" }
): Promise<Member> {
  invalidateCache();
  const { data, error } = await supabase
    .from("members")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update member: ${error.message}`);
  }

  return data;
}

/**
 * 5.1 Delete a member and clean up associated records
 */
export async function deleteMember(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  invalidateCache();
  // Delete associated child records first to satisfy foreign key constraints
  await supabase.from("meal_entries").delete().eq("member_id", id);
  await supabase.from("deposits").delete().eq("member_id", id);
  await supabase.from("adjustments").delete().eq("member_id", id);

  // Delete the member record
  const { error } = await supabase.from("members").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete member: ${error.message}`);
  }
}

/**
 * 6. Get meal entries for a specific date
 */
export async function getMealsForDate(
  supabase: SupabaseClient,
  dateString: string
): Promise<MealEntry[]> {
  const { data, error } = await supabase
    .from("meal_entries")
    .select("*, member:members(*)")
    .eq("meal_date", dateString);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(`Failed to fetch meals for date: ${error.message}`);
  }

  return (data || []).map((row) => ({
    ...row,
    unit_price: Number(row.unit_price),
  }));
}

/**
 * 7. Save or update daily meals for all members
 */
export async function saveDailyMeals(
  supabase: SupabaseClient,
  dateString: string,
  entries: { member_id: string; lunch: number; dinner: number }[],
  unitPrice: number
): Promise<void> {
  const isFriday = isFridayDate(dateString);

  // Prepare upsert payloads for each member
  const rowsToUpsert: Array<{
    member_id: string;
    meal_date: string;
    session: "lunch" | "dinner";
    quantity: number;
    unit_price: number;
  }> = [];

  for (const item of entries) {
    // Lunch session
    rowsToUpsert.push({
      member_id: item.member_id,
      meal_date: dateString,
      session: "lunch",
      quantity: Math.max(0, item.lunch || 0),
      unit_price: unitPrice,
    });

    // Dinner session (Disabled/0 on Friday)
    rowsToUpsert.push({
      member_id: item.member_id,
      meal_date: dateString,
      session: "dinner",
      quantity: isFriday ? 0 : Math.max(0, item.dinner || 0),
      unit_price: unitPrice,
    });
  }

  const { error } = await supabase.from("meal_entries").upsert(rowsToUpsert, {
    onConflict: "member_id,meal_date,session",
  });

  if (error) {
    if (error.message.includes("meal_entries_quantity_check")) {
      throw new Error(
        "গেস্ট মিল সেভ করতে সুপাবেস কোয়েরি রান করুন: ALTER TABLE public.meal_entries DROP CONSTRAINT IF EXISTS meal_entries_quantity_check; ALTER TABLE public.meal_entries ADD CONSTRAINT meal_entries_quantity_check CHECK (quantity >= 0);"
      );
    }
    throw new Error(`Failed to save daily meals: ${error.message}`);
  }

  invalidateCache();
}

/**
 * 8. Delete daily meal entries for a given date
 */
export async function deleteDailyMeals(
  supabase: SupabaseClient,
  dateString: string
): Promise<void> {
  invalidateCache();
  const { error } = await supabase
    .from("meal_entries")
    .delete()
    .eq("meal_date", dateString);

  if (error) {
    throw new Error(`Failed to delete daily meals: ${error.message}`);
  }
}

/**
 * 9. Fetch deposits with member details
 */
export async function getDeposits(supabase: SupabaseClient): Promise<Deposit[]> {
  const cached = getFromCache<Deposit[]>("deposits");
  if (cached) return cached;

  const { data, error } = await supabase
    .from("deposits")
    .select("*, member:members(*)")
    .order("deposit_date", { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(`Failed to fetch deposits: ${error.message}`);
  }

  const result: Deposit[] = (data || []).map((d) => ({
    ...d,
    amount: Number(d.amount),
  }));

  setToCache("deposits", result);
  return result;
}

/**
 * 10. Add deposit
 */
export async function addDeposit(
  supabase: SupabaseClient,
  deposit: {
    member_id: string;
    amount: number;
    deposit_date: string;
    note?: string;
  }
): Promise<Deposit> {
  invalidateCache();
  if (deposit.amount <= 0) {
    throw new Error("Deposit amount must be greater than zero.");
  }

  const { data, error } = await supabase
    .from("deposits")
    .insert({
      member_id: deposit.member_id,
      amount: deposit.amount,
      deposit_date: deposit.deposit_date,
      note: deposit.note?.trim() || null,
    })
    .select("*, member:members(*)")
    .single();

  if (error) {
    throw new Error(`Failed to record deposit: ${error.message}`);
  }

  return {
    ...data,
    amount: Number(data.amount),
  };
}

/**
 * 11. Update deposit
 */
export async function updateDeposit(
  supabase: SupabaseClient,
  id: string,
  updates: {
    member_id: string;
    amount: number;
    deposit_date: string;
    note?: string;
  }
): Promise<Deposit> {
  invalidateCache();
  const { data, error } = await supabase
    .from("deposits")
    .update({
      member_id: updates.member_id,
      amount: updates.amount,
      deposit_date: updates.deposit_date,
      note: updates.note?.trim() || null,
    })
    .eq("id", id)
    .select("*, member:members(*)")
    .single();

  if (error) {
    throw new Error(`Failed to update deposit: ${error.message}`);
  }

  return {
    ...data,
    amount: Number(data.amount),
  };
}

/**
 * 12. Delete deposit
 */
export async function deleteDeposit(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  invalidateCache();
  const { error } = await supabase.from("deposits").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete deposit: ${error.message}`);
  }
}

export interface DashboardData {
  summary: GroupSummary;
  todayMeals: MealEntry[];
  recentDeposits: Deposit[];
}

/**
 * 12.1 Unified Dashboard Data Fetcher (Fast single parallel query)
 */
export async function getDashboardData(
  supabase: SupabaseClient
): Promise<DashboardData> {
  const cached = getFromCache<DashboardData>("dashboard_data");
  if (cached) return cached;

  const today = getTodayInDhaka();

  // Execute 3 essential tables in parallel in a single round-trip!
  const [membersRes, mealsRes, depositsRes] = await Promise.all([
    supabase.from("members").select("*").order("name", { ascending: true }),
    supabase.from("meal_entries").select("*"),
    supabase.from("deposits").select("*, member:members(*)").order("deposit_date", { ascending: false }),
  ]);

  if (membersRes.error) {
    throw new Error(membersRes.error.message);
  }

  const members: Member[] = membersRes.data || [];
  const membersMap = new Map(members.map((m) => [m.id, m]));

  const allMeals: MealEntry[] = (mealsRes.data || []).map((m) => ({
    ...m,
    unit_price: Number(m.unit_price),
    member: membersMap.get(m.member_id),
  }));

  const allDeposits: Deposit[] = (depositsRes.data || []).map((d) => ({
    ...d,
    amount: Number(d.amount),
  }));

  // Today's meal entries
  const todayMeals = allMeals.filter((m) => m.meal_date === today);

  // Recent 5 deposits
  const recentDeposits = allDeposits.slice(0, 5);

  // Member summaries
  const memberSummaries: MemberSummary[] = members.map((member) => {
    const memberMeals = allMeals.filter((m) => m.member_id === member.id);
    const memberDeposits = allDeposits.filter((d) => d.member_id === member.id);

    let totalLunch = 0;
    let totalDinner = 0;
    let totalCost = 0;

    for (const meal of memberMeals) {
      if (meal.quantity > 0) {
        if (meal.session === "lunch") totalLunch += meal.quantity;
        if (meal.session === "dinner") totalDinner += meal.quantity;
        totalCost += meal.quantity * meal.unit_price;
      }
    }

    const totalDeposited = memberDeposits.reduce((acc, d) => acc + d.amount, 0);
    const balance = totalDeposited - totalCost;

    return {
      id: member.id,
      name: member.name,
      status: member.status,
      total_meals: totalLunch + totalDinner,
      total_lunch: totalLunch,
      total_dinner: totalDinner,
      total_meal_cost: totalCost,
      total_deposited: totalDeposited,
      balance,
    };
  });

  // Today's group statistics
  let todayTotalMeals = 0;
  let todayTotalCost = 0;
  let todayLunchCount = 0;
  let todayDinnerCount = 0;

  for (const meal of todayMeals) {
    if (meal.quantity > 0) {
      todayTotalMeals += meal.quantity;
      todayTotalCost += meal.quantity * meal.unit_price;
      if (meal.session === "lunch") todayLunchCount += meal.quantity;
      if (meal.session === "dinner") todayDinnerCount += meal.quantity;
    }
  }

  // All-time group financial statistics
  const totalGroupDeposit = allDeposits.reduce((acc, d) => acc + d.amount, 0);
  const totalGroupExpense = allMeals.reduce(
    (acc, m) => acc + (m.quantity > 0 ? m.quantity * m.unit_price : 0),
    0
  );
  const remainingGroupBalance = totalGroupDeposit - totalGroupExpense;
  const activeMembersCount = members.filter((m) => m.status === "active").length;

  const summary: GroupSummary = {
    today_date: today,
    today_total_meals: todayTotalMeals,
    today_total_cost: todayTotalCost,
    today_lunch_count: todayLunchCount,
    today_dinner_count: todayDinnerCount,
    total_group_deposit: totalGroupDeposit,
    total_group_expense: totalGroupExpense,
    remaining_group_balance: remainingGroupBalance,
    active_members_count: activeMembersCount,
    total_members_count: members.length,
    member_summaries: memberSummaries,
  };

  const dashboardData: DashboardData = {
    summary,
    todayMeals,
    recentDeposits,
  };

  setToCache("dashboard_data", dashboardData);
  setToCache("group_summary", summary);
  setToCache("members", members);
  setToCache("deposits", allDeposits);

  return dashboardData;
}

/**
 * 13. Comprehensive Group & Member Financial Summary
 */
export async function getGroupSummary(
  supabase: SupabaseClient
): Promise<GroupSummary> {
  const cached = getFromCache<GroupSummary>("group_summary");
  if (cached) return cached;

  const today = getTodayInDhaka();

  // Fetch parallel datasets
  const [membersRes, mealsRes, depositsRes, todayMealsRes] = await Promise.all([
    supabase.from("members").select("*").order("name", { ascending: true }),
    supabase.from("meal_entries").select("*"),
    supabase.from("deposits").select("*"),
    supabase.from("meal_entries").select("*").eq("meal_date", today),
  ]);

  if (membersRes.error) {
    throw new Error(membersRes.error.message);
  }

  const members: Member[] = membersRes.data || [];
  const allMeals: MealEntry[] = (mealsRes.data || []).map((m) => ({
    ...m,
    unit_price: Number(m.unit_price),
  }));
  const allDeposits: Deposit[] = (depositsRes.data || []).map((d) => ({
    ...d,
    amount: Number(d.amount),
  }));
  const todayMeals: MealEntry[] = (todayMealsRes.data || []).map((m) => ({
    ...m,
    unit_price: Number(m.unit_price),
  }));

  // Member summaries map
  const memberSummaries: MemberSummary[] = members.map((member) => {
    const memberMeals = allMeals.filter((m) => m.member_id === member.id);
    const memberDeposits = allDeposits.filter((d) => d.member_id === member.id);

    let totalLunch = 0;
    let totalDinner = 0;
    let totalCost = 0;

    for (const meal of memberMeals) {
      if (meal.quantity > 0) {
        if (meal.session === "lunch") totalLunch += meal.quantity;
        if (meal.session === "dinner") totalDinner += meal.quantity;
        totalCost += meal.quantity * meal.unit_price;
      }
    }

    const totalDeposited = memberDeposits.reduce((acc, d) => acc + d.amount, 0);
    const balance = totalDeposited - totalCost;

    return {
      id: member.id,
      name: member.name,
      status: member.status,
      total_meals: totalLunch + totalDinner,
      total_lunch: totalLunch,
      total_dinner: totalDinner,
      total_meal_cost: totalCost,
      total_deposited: totalDeposited,
      balance,
    };
  });

  // Today's group statistics
  let todayTotalMeals = 0;
  let todayTotalCost = 0;
  let todayLunchCount = 0;
  let todayDinnerCount = 0;

  for (const meal of todayMeals) {
    if (meal.quantity > 0) {
      todayTotalMeals += meal.quantity;
      todayTotalCost += meal.quantity * meal.unit_price;
      if (meal.session === "lunch") todayLunchCount += meal.quantity;
      if (meal.session === "dinner") todayDinnerCount += meal.quantity;
    }
  }

  // All-time group financial statistics
  const totalGroupDeposit = allDeposits.reduce((acc, d) => acc + d.amount, 0);
  const totalGroupExpense = allMeals.reduce(
    (acc, m) => acc + (m.quantity > 0 ? m.quantity * m.unit_price : 0),
    0
  );
  const remainingGroupBalance = totalGroupDeposit - totalGroupExpense;

  const activeMembersCount = members.filter((m) => m.status === "active").length;

  return {
    today_date: today,
    today_total_meals: todayTotalMeals,
    today_total_cost: todayTotalCost,
    today_lunch_count: todayLunchCount,
    today_dinner_count: todayDinnerCount,
    total_group_deposit: totalGroupDeposit,
    total_group_expense: totalGroupExpense,
    remaining_group_balance: remainingGroupBalance,
    active_members_count: activeMembersCount,
    total_members_count: members.length,
    member_summaries: memberSummaries,
  };
}

/**
 * 14. Daily Group Ledger (Group by date)
 */
export async function getDailyLedger(
  supabase: SupabaseClient,
  startDate?: string,
  endDate?: string
): Promise<DailyLedgerRow[]> {
  let query = supabase
    .from("meal_entries")
    .select("*")
    .order("meal_date", { ascending: false });

  if (startDate) query = query.gte("meal_date", startDate);
  if (endDate) query = query.lte("meal_date", endDate);

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(`Failed to fetch daily ledger: ${error.message}`);
  }

  const entries: MealEntry[] = (data || []).map((d) => ({
    ...d,
    unit_price: Number(d.unit_price),
  }));

  // Group entries by date
  const mapByDate = new Map<string, MealEntry[]>();
  for (const entry of entries) {
    const list = mapByDate.get(entry.meal_date) || [];
    list.push(entry);
    mapByDate.set(entry.meal_date, list);
  }

  const rows: DailyLedgerRow[] = [];
  for (const [date, list] of mapByDate.entries()) {
    let lunchCount = 0;
    let dinnerCount = 0;
    let totalCost = 0;
    const membersAte = new Set<string>();

    for (const item of list) {
      if (item.quantity > 0) {
        membersAte.add(item.member_id);
        totalCost += item.quantity * item.unit_price;
        if (item.session === "lunch") lunchCount += item.quantity;
        if (item.session === "dinner") dinnerCount += item.quantity;
      }
    }

    rows.push({
      meal_date: date,
      day_name: getWeekdayName(date),
      is_friday: isFridayDate(date),
      lunch_count: lunchCount,
      dinner_count: dinnerCount,
      total_meals: lunchCount + dinnerCount,
      total_cost: totalCost,
      active_members_ate: membersAte.size,
    });
  }

  return rows.sort((a, b) => b.meal_date.localeCompare(a.meal_date));
}

/**
 * 15. Individual Member Ledger
 */
export async function getMemberLedger(
  supabase: SupabaseClient,
  memberId: string
): Promise<{
  member: Member | null;
  dailyMeals: Array<{
    meal_date: string;
    day_name: string;
    lunch: number;
    dinner: number;
    total_meals: number;
    total_cost: number;
  }>;
  deposits: Deposit[];
  summary: {
    total_meals: number;
    total_cost: number;
    total_deposited: number;
    balance: number;
  };
}> {
  const [memberRes, mealsRes, depositsRes] = await Promise.all([
    supabase.from("members").select("*").eq("id", memberId).single(),
    supabase
      .from("meal_entries")
      .select("*")
      .eq("member_id", memberId)
      .order("meal_date", { ascending: false }),
    supabase
      .from("deposits")
      .select("*")
      .eq("member_id", memberId)
      .order("deposit_date", { ascending: false }),
  ]);

  const member: Member | null = memberRes.data || null;
  const meals: MealEntry[] = (mealsRes.data || []).map((m) => ({
    ...m,
    unit_price: Number(m.unit_price),
  }));
  const deposits: Deposit[] = (depositsRes.data || []).map((d) => ({
    ...d,
    amount: Number(d.amount),
  }));

  // Aggregate meals by date
  const mapByDate = new Map<
    string,
    { lunch: number; dinner: number; cost: number }
  >();

  for (const m of meals) {
    const existing = mapByDate.get(m.meal_date) || {
      lunch: 0,
      dinner: 0,
      cost: 0,
    };
    if (m.session === "lunch" && m.quantity > 0) {
      existing.lunch += m.quantity;
      existing.cost += m.quantity * m.unit_price;
    }
    if (m.session === "dinner" && m.quantity > 0) {
      existing.dinner += m.quantity;
      existing.cost += m.quantity * m.unit_price;
    }
    mapByDate.set(m.meal_date, existing);
  }

  const dailyMeals = Array.from(mapByDate.entries())
    .map(([date, data]) => ({
      meal_date: date,
      day_name: getWeekdayName(date),
      lunch: data.lunch,
      dinner: data.dinner,
      total_meals: data.lunch + data.dinner,
      total_cost: data.cost,
    }))
    .sort((a, b) => b.meal_date.localeCompare(a.meal_date));

  const totalMeals = dailyMeals.reduce((acc, m) => acc + m.total_meals, 0);
  const totalCost = dailyMeals.reduce((acc, m) => acc + m.total_cost, 0);
  const totalDeposited = deposits.reduce((acc, d) => acc + d.amount, 0);
  const balance = totalDeposited - totalCost;

  return {
    member,
    dailyMeals,
    deposits,
    summary: {
      total_meals: totalMeals,
      total_cost: totalCost,
      total_deposited: totalDeposited,
      balance,
    },
  };
}

/**
 * 16. Comprehensive Period Ledger Report
 * Computes Opening / Previous balance (unpaid / advance),
 * Period Activity (meals, cost, deposits, net flow),
 * Closing balance, daily breakdown, and member-wise statements.
 */
export async function getPeriodLedgerReport(
  supabase: SupabaseClient,
  startDate?: string,
  endDate?: string
): Promise<PeriodLedgerReport> {
  const cacheKey = `period_ledger_${startDate || "all"}_${endDate || "all"}`;
  const cached = getFromCache<PeriodLedgerReport>(cacheKey);
  if (cached) return cached;

  const [membersRes, mealsRes, depositsRes] = await Promise.all([
    supabase.from("members").select("*").order("name", { ascending: true }),
    supabase.from("meal_entries").select("*"),
    supabase.from("deposits").select("*"),
  ]);

  if (membersRes.error) {
    if (membersRes.error.code === "42P01" || membersRes.error.code === "PGRST205") {
      return {
        startDate,
        endDate,
        opening: { total_meals: 0, total_cost: 0, total_deposit: 0, balance: 0, unpaid: 0, advance: 0 },
        period: { total_meals: 0, lunch_count: 0, dinner_count: 0, total_cost: 0, total_deposit: 0, net_flow: 0, active_days: 0 },
        closing: { total_cost: 0, total_deposit: 0, balance: 0, unpaid: 0, advance: 0 },
        dailyRows: [],
        memberStatements: [],
      };
    }
    throw new Error(`Failed to load members for ledger: ${membersRes.error.message}`);
  }

  const members: Member[] = membersRes.data || [];
  const meals: MealEntry[] = (mealsRes.data || []).map((m) => ({
    ...m,
    unit_price: Number(m.unit_price),
  }));
  const deposits: Deposit[] = (depositsRes.data || []).map((d) => ({
    ...d,
    amount: Number(d.amount),
  }));

  // Separate Opening (records strictly BEFORE startDate)
  let openingMealsCount = 0;
  let openingCost = 0;
  let openingDeposit = 0;

  // Selected Period aggregates
  let periodMealsCount = 0;
  let periodLunchCount = 0;
  let periodDinnerCount = 0;
  let periodCost = 0;
  let periodDeposit = 0;

  // Maps for member-level calculation
  const memberPreviousMap = new Map<string, { cost: number; deposit: number }>();
  const memberPeriodMap = new Map<
    string,
    { meals: number; lunch: number; dinner: number; cost: number; deposit: number }
  >();

  for (const m of members) {
    memberPreviousMap.set(m.id, { cost: 0, deposit: 0 });
    memberPeriodMap.set(m.id, { meals: 0, lunch: 0, dinner: 0, cost: 0, deposit: 0 });
  }

  // Daily map for period rows
  const dailyPeriodMap = new Map<string, MealEntry[]>();

  // Process all meals
  for (const meal of meals) {
    const isBeforeStart = startDate ? meal.meal_date < startDate : false;
    const isAfterEnd = endDate ? meal.meal_date > endDate : false;
    const isInPeriod = !isBeforeStart && !isAfterEnd;

    const mealCost = meal.quantity * meal.unit_price;

    if (isBeforeStart) {
      if (meal.quantity > 0) {
        openingMealsCount += meal.quantity;
        openingCost += mealCost;
        const prev = memberPreviousMap.get(meal.member_id);
        if (prev) {
          prev.cost += mealCost;
        }
      }
    } else if (isInPeriod) {
      if (meal.quantity > 0) {
        periodMealsCount += meal.quantity;
        periodCost += mealCost;
        if (meal.session === "lunch") periodLunchCount += meal.quantity;
        if (meal.session === "dinner") periodDinnerCount += meal.quantity;

        const pMember = memberPeriodMap.get(meal.member_id);
        if (pMember) {
          pMember.meals += meal.quantity;
          pMember.cost += mealCost;
          if (meal.session === "lunch") pMember.lunch += meal.quantity;
          if (meal.session === "dinner") pMember.dinner += meal.quantity;
        }

        const dateList = dailyPeriodMap.get(meal.meal_date) || [];
        dateList.push(meal);
        dailyPeriodMap.set(meal.meal_date, dateList);
      }
    }
  }

  // Process all deposits
  for (const dep of deposits) {
    const isBeforeStart = startDate ? dep.deposit_date < startDate : false;
    const isAfterEnd = endDate ? dep.deposit_date > endDate : false;
    const isInPeriod = !isBeforeStart && !isAfterEnd;

    if (isBeforeStart) {
      openingDeposit += dep.amount;
      const prev = memberPreviousMap.get(dep.member_id);
      if (prev) {
        prev.deposit += dep.amount;
      }
    } else if (isInPeriod) {
      periodDeposit += dep.amount;
      const pMember = memberPeriodMap.get(dep.member_id);
      if (pMember) {
        pMember.deposit += dep.amount;
      }
    }
  }

  // Opening calculations
  const openingBalance = openingDeposit - openingCost;
  const openingUnpaid = openingBalance < 0 ? Math.abs(openingBalance) : 0;
  const openingAdvance = openingBalance >= 0 ? openingBalance : 0;

  // Period net flow
  const periodNetFlow = periodDeposit - periodCost;

  // Closing calculations (Opening + Period)
  const closingCost = openingCost + periodCost;
  const closingDeposit = openingDeposit + periodDeposit;
  const closingBalance = closingDeposit - closingCost;
  const closingUnpaid = closingBalance < 0 ? Math.abs(closingBalance) : 0;
  const closingAdvance = closingBalance >= 0 ? closingBalance : 0;

  // Daily Ledger Rows
  const dailyRows: DailyLedgerRow[] = [];
  for (const [date, list] of dailyPeriodMap.entries()) {
    let lunchCount = 0;
    let dinnerCount = 0;
    let totalCost = 0;
    const membersAte = new Set<string>();

    for (const item of list) {
      if (item.quantity > 0) {
        membersAte.add(item.member_id);
        totalCost += item.quantity * item.unit_price;
        if (item.session === "lunch") lunchCount += item.quantity;
        if (item.session === "dinner") dinnerCount += item.quantity;
      }
    }

    dailyRows.push({
      meal_date: date,
      day_name: getWeekdayName(date),
      is_friday: isFridayDate(date),
      lunch_count: lunchCount,
      dinner_count: dinnerCount,
      total_meals: lunchCount + dinnerCount,
      total_cost: totalCost,
      active_members_ate: membersAte.size,
    });
  }
  dailyRows.sort((a, b) => b.meal_date.localeCompare(a.meal_date));

  // Member statements
  const memberStatements: PeriodMemberStatement[] = members.map((m) => {
    const prev = memberPreviousMap.get(m.id) || { cost: 0, deposit: 0 };
    const curr = memberPeriodMap.get(m.id) || { meals: 0, lunch: 0, dinner: 0, cost: 0, deposit: 0 };

    const prevBalance = prev.deposit - prev.cost;
    const prevUnpaid = prevBalance < 0 ? Math.abs(prevBalance) : 0;

    const periodNet = curr.deposit - curr.cost;
    const closingBal = prevBalance + curr.deposit - curr.cost;
    const closingUnpaid = closingBal < 0 ? Math.abs(closingBal) : 0;

    return {
      member_id: m.id,
      member_name: m.name,
      status: m.status,
      previous_cost: prev.cost,
      previous_deposit: prev.deposit,
      previous_balance: prevBalance,
      previous_unpaid: prevUnpaid,
      period_meals: curr.meals,
      period_lunch: curr.lunch,
      period_dinner: curr.dinner,
      period_cost: curr.cost,
      period_deposit: curr.deposit,
      period_net: periodNet,
      closing_balance: closingBal,
      closing_unpaid: closingUnpaid,
    };
  });

  const report: PeriodLedgerReport = {
    startDate,
    endDate,
    opening: {
      total_meals: openingMealsCount,
      total_cost: openingCost,
      total_deposit: openingDeposit,
      balance: openingBalance,
      unpaid: openingUnpaid,
      advance: openingAdvance,
    },
    period: {
      total_meals: periodMealsCount,
      lunch_count: periodLunchCount,
      dinner_count: periodDinnerCount,
      total_cost: periodCost,
      total_deposit: periodDeposit,
      net_flow: periodNetFlow,
      active_days: dailyRows.length,
    },
    closing: {
      total_cost: closingCost,
      total_deposit: closingDeposit,
      balance: closingBalance,
      unpaid: closingUnpaid,
      advance: closingAdvance,
    },
    dailyRows,
    memberStatements,
  };

  setToCache(cacheKey, report);
  return report;
}
