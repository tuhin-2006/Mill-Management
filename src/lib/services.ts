import { SupabaseClient } from "@supabase/supabase-js";
import {
  Member,
  MealEntry,
  Deposit,
  Settings,
  MemberSummary,
  GroupSummary,
  DailyLedgerRow,
  DailyMemberMealDetail,
  DailyDepositDetail,
  PeriodPaymentRecord,
  DateGroupedPayment,
  PeriodLedgerReport,
  PeriodMemberStatement,
  UserProfile,
  UserRole,
  GroupAggregateReport,
  MemberPersonalStatement,
  EmailLog,
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
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > DEFAULT_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return item.data as T;
}

function setToCache<T>(key: string, data: T): void {
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
  auto_email_enabled: false,
  weekly_report_day: "Friday",
  weekly_report_time: "20:00",
  gas_web_app_url: null,
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

  // If columns don't exist yet in Supabase, retry without them gracefully
  if (error && (error.message.includes("friday_meal_price") || error.message.includes("group_ledger_viewer_email") || error.message.includes("gas_web_app_url"))) {
    const fallbackUpdates = { ...updates };
    if (error.message.includes("friday_meal_price")) delete fallbackUpdates.friday_meal_price;
    if (error.message.includes("group_ledger_viewer_email")) delete fallbackUpdates.group_ledger_viewer_email;
    if (error.message.includes("gas_web_app_url")) delete fallbackUpdates.gas_web_app_url;
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
  name: string,
  email?: string | null
): Promise<Member> {
  invalidateCache();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Member name cannot be empty.");

  const payload: { name: string; status: "active"; email?: string | null } = {
    name: trimmed,
    status: "active",
  };
  if (email !== undefined) {
    payload.email = email && email.trim() ? email.trim() : null;
  }

  const { data, error } = await supabase
    .from("members")
    .insert(payload)
    .select()
    .single();

  if (error) {
    // Graceful fallback if email column does not exist yet
    if (error.message.includes("email") && payload.email !== undefined) {
      delete payload.email;
      const retry = await supabase.from("members").insert(payload).select().single();
      if (retry.error) throw new Error(`Failed to add member: ${retry.error.message}`);
      return retry.data;
    }
    throw new Error(`Failed to add member: ${error.message}`);
  }

  return data;
}

/**
 * 5. Update an existing member (name / status / email)
 */
export async function updateMember(
  supabase: SupabaseClient,
  id: string,
  updates: { name?: string; status?: "active" | "inactive"; email?: string | null }
): Promise<Member> {
  invalidateCache();
  const { data, error } = await supabase
    .from("members")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.message.includes("email") && "email" in updates) {
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.email;
      const retry = await supabase.from("members").update(fallbackUpdates).eq("id", id).select().single();
      if (retry.error) throw new Error(`Failed to update member: ${retry.error.message}`);
      return retry.data;
    }
    throw new Error(`Failed to update member: ${error.message}`);
  }

  return data;
}

/**
 * Fetch recent email reporting delivery logs
 */
export async function getEmailLogs(
  supabase: SupabaseClient,
  limit = 20
) {
  const { data, error } = await supabase
    .from("email_logs")
    .select("*, member:members(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }
  return data || [];
}

/**
 * Delete a single email log entry
 */
export async function deleteEmailLog(
  supabase: SupabaseClient,
  logId: string
): Promise<void> {
  const { error } = await supabase.from("email_logs").delete().eq("id", logId);
  if (error) {
    throw new Error(`Failed to delete email log: ${error.message}`);
  }
}

/**
 * Clear email logs by mode
 */
export async function clearEmailLogs(
  supabase: SupabaseClient,
  mode: "all" | "failed_or_skipped" | "older_than_30_days" = "all"
): Promise<void> {
  let query = supabase.from("email_logs").delete();

  if (mode === "failed_or_skipped") {
    query = query.in("status", ["failed", "skipped_duplicate"]);
  } else if (mode === "older_than_30_days") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    query = query.lt("created_at", thirtyDaysAgo);
  } else {
    query = query.neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { error } = await query;
  if (error) {
    throw new Error(`Failed to clear email logs: ${error.message}`);
  }
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
  const cacheKey = `meals_date_${dateString}`;
  const cached = getFromCache<MealEntry[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("meal_entries")
    .select("*, member:members(*)")
    .eq("meal_date", dateString);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(`Failed to fetch meals for date: ${error.message}`);
  }

  const result: MealEntry[] = (data || []).map((row) => ({
    ...row,
    unit_price: Number(row.unit_price),
  }));
  setToCache(cacheKey, result);
  return result;
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

  // Fetch parallel datasets (today meals are derived in-memory from all meals, saving 1 remote database query)
  const [membersRes, mealsRes, depositsRes] = await Promise.all([
    supabase.from("members").select("*").order("name", { ascending: true }),
    supabase.from("meal_entries").select("*"),
    supabase.from("deposits").select("*"),
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
  const todayMeals: MealEntry[] = allMeals.filter((m) => m.meal_date === today);

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
  endDate?: string,
  memberId?: string
): Promise<PeriodLedgerReport> {
  const isMemberFiltered = Boolean(memberId && memberId !== "all");
  const cacheKey = `period_ledger_${startDate || "all"}_${endDate || "all"}_${memberId || "all"}`;
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
        selectedMemberId: memberId || "all",
        opening: { total_meals: 0, total_cost: 0, total_deposit: 0, balance: 0, unpaid: 0, advance: 0 },
        period: { total_meals: 0, lunch_count: 0, dinner_count: 0, total_cost: 0, total_deposit: 0, net_flow: 0, active_days: 0 },
        closing: { total_cost: 0, total_deposit: 0, balance: 0, unpaid: 0, advance: 0 },
        dailyRows: [],
        memberStatements: [],
        paymentTransactions: [],
      };
    }
    throw new Error(`Failed to load members for ledger: ${membersRes.error.message}`);
  }

  const members: Member[] = membersRes.data || [];
  const targetMember = isMemberFiltered ? members.find((m) => m.id === memberId) : undefined;
  const targetMemberName = targetMember?.name || "Unknown";

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

  const memberMap = new Map<string, string>();
  for (const m of members) {
    memberMap.set(m.id, m.name);
    memberPreviousMap.set(m.id, { cost: 0, deposit: 0 });
    memberPeriodMap.set(m.id, { meals: 0, lunch: 0, dinner: 0, cost: 0, deposit: 0 });
  }

  // Daily map for period rows
  const dailyPeriodMealMap = new Map<string, MealEntry[]>();
  const dailyPeriodDepositMap = new Map<string, Deposit[]>();
  const paymentTransactions: PeriodPaymentRecord[] = [];

  // Process all meals
  for (const meal of meals) {
    const isBeforeStart = startDate ? meal.meal_date < startDate : false;
    const isAfterEnd = endDate ? meal.meal_date > endDate : false;
    const isInPeriod = !isBeforeStart && !isAfterEnd;

    const mealCost = meal.quantity * meal.unit_price;

    if (isBeforeStart) {
      if (meal.quantity > 0) {
        if (!isMemberFiltered || meal.member_id === memberId) {
          openingMealsCount += meal.quantity;
          openingCost += mealCost;
        }
        const prev = memberPreviousMap.get(meal.member_id);
        if (prev) {
          prev.cost += mealCost;
        }
      }
    } else if (isInPeriod) {
      if (meal.quantity > 0) {
        if (!isMemberFiltered || meal.member_id === memberId) {
          periodMealsCount += meal.quantity;
          periodCost += mealCost;
          if (meal.session === "lunch") periodLunchCount += meal.quantity;
          if (meal.session === "dinner") periodDinnerCount += meal.quantity;

          const dateList = dailyPeriodMealMap.get(meal.meal_date) || [];
          dateList.push(meal);
          dailyPeriodMealMap.set(meal.meal_date, dateList);
        }

        const pMember = memberPeriodMap.get(meal.member_id);
        if (pMember) {
          pMember.meals += meal.quantity;
          pMember.cost += mealCost;
          if (meal.session === "lunch") pMember.lunch += meal.quantity;
          if (meal.session === "dinner") pMember.dinner += meal.quantity;
        }
      }
    }
  }

  // Process all deposits
  for (const dep of deposits) {
    const isBeforeStart = startDate ? dep.deposit_date < startDate : false;
    const isAfterEnd = endDate ? dep.deposit_date > endDate : false;
    const isInPeriod = !isBeforeStart && !isAfterEnd;

    if (isBeforeStart) {
      if (!isMemberFiltered || dep.member_id === memberId) {
        openingDeposit += dep.amount;
      }
      const prev = memberPreviousMap.get(dep.member_id);
      if (prev) {
        prev.deposit += dep.amount;
      }
    } else if (isInPeriod) {
      if (!isMemberFiltered || dep.member_id === memberId) {
        periodDeposit += dep.amount;

        // Add to daily deposit map
        const dateList = dailyPeriodDepositMap.get(dep.deposit_date) || [];
        dateList.push(dep);
        dailyPeriodDepositMap.set(dep.deposit_date, dateList);

        // Record payment transaction
        paymentTransactions.push({
          id: dep.id,
          deposit_date: dep.deposit_date,
          member_id: dep.member_id,
          member_name: memberMap.get(dep.member_id) || "Unknown",
          amount: dep.amount,
          note: dep.note || undefined,
          created_at: dep.created_at,
        });
      }

      const pMember = memberPeriodMap.get(dep.member_id);
      if (pMember) {
        pMember.deposit += dep.amount;
      }
    }
  }

  // Sort payment transactions newest first
  paymentTransactions.sort((a, b) => b.deposit_date.localeCompare(a.deposit_date));

  // Group payment transactions by date (descending) with aggregated day totals
  const datePaymentMap = new Map<string, { total_amount: number; payments: PeriodPaymentRecord[] }>();
  for (const p of paymentTransactions) {
    const existing = datePaymentMap.get(p.deposit_date) || { total_amount: 0, payments: [] };
    existing.total_amount += p.amount;
    existing.payments.push(p);
    datePaymentMap.set(p.deposit_date, existing);
  }

  const dateGroupedPayments: DateGroupedPayment[] = Array.from(datePaymentMap.entries())
    .map(([date, grp]) => ({
      deposit_date: date,
      day_name: getWeekdayName(date),
      is_friday: isFridayDate(date),
      total_amount: grp.total_amount,
      payment_count: grp.payments.length,
      payments: grp.payments,
    }))
    .sort((a, b) => b.deposit_date.localeCompare(a.deposit_date));

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

  // Collect all unique dates in the period (meals or deposits)
  const allPeriodDates = new Set<string>();
  for (const date of dailyPeriodMealMap.keys()) allPeriodDates.add(date);
  for (const date of dailyPeriodDepositMap.keys()) allPeriodDates.add(date);

  const sortedDatesAsc = Array.from(allPeriodDates).sort((a, b) => a.localeCompare(b));

  // Compute chronological progression: Previous Balance -> Day Cost -> Day Deposit -> Running Balance
  let currentRunningBalance = openingBalance;
  const rowsAsc: DailyLedgerRow[] = [];

  for (const date of sortedDatesAsc) {
    const mealList = dailyPeriodMealMap.get(date) || [];
    const depositList = dailyPeriodDepositMap.get(date) || [];

    let lunchCount = 0;
    let dinnerCount = 0;
    let totalCost = 0;
    const membersAte = new Set<string>();

    const memberMealMap = new Map<string, { lunch: number; dinner: number; cost: number }>();
    for (const m of mealList) {
      if (m.quantity > 0) {
        membersAte.add(m.member_id);
        const mCost = m.quantity * m.unit_price;
        totalCost += mCost;
        if (m.session === "lunch") lunchCount += m.quantity;
        if (m.session === "dinner") dinnerCount += m.quantity;

        const currentM = memberMealMap.get(m.member_id) || { lunch: 0, dinner: 0, cost: 0 };
        if (m.session === "lunch") currentM.lunch += m.quantity;
        if (m.session === "dinner") currentM.dinner += m.quantity;
        currentM.cost += mCost;
        memberMealMap.set(m.member_id, currentM);
      }
    }

    const memberMeals: DailyMemberMealDetail[] = Array.from(memberMealMap.entries()).map(([mId, detail]) => ({
      member_id: mId,
      member_name: memberMap.get(mId) || "Unknown",
      lunch: detail.lunch,
      dinner: detail.dinner,
      total_meals: detail.lunch + detail.dinner,
      cost: detail.cost,
    }));

    let dayDeposit = 0;
    const dailyDepositsList: DailyDepositDetail[] = [];
    for (const dep of depositList) {
      dayDeposit += dep.amount;
      dailyDepositsList.push({
        id: dep.id,
        member_id: dep.member_id,
        member_name: memberMap.get(dep.member_id) || "Unknown",
        amount: dep.amount,
        note: dep.note || undefined,
      });
    }

    const prevDayBal = currentRunningBalance;
    currentRunningBalance = currentRunningBalance + dayDeposit - totalCost;

    rowsAsc.push({
      meal_date: date,
      day_name: getWeekdayName(date),
      is_friday: isFridayDate(date),
      lunch_count: lunchCount,
      dinner_count: dinnerCount,
      total_meals: lunchCount + dinnerCount,
      total_cost: totalCost,
      active_members_ate: membersAte.size,
      daily_deposit: dayDeposit,
      daily_deposits_list: dailyDepositsList,
      member_meals: memberMeals,
      previous_day_balance: prevDayBal,
      running_balance: currentRunningBalance,
    });
  }

  // Reverse to descending (latest date on top)
  const dailyRows: DailyLedgerRow[] = rowsAsc.reverse();

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
    selectedMemberId: memberId || "all",
    selectedMemberName: isMemberFiltered ? targetMemberName : undefined,
    allMembers: members,
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
    paymentTransactions,
    dateGroupedPayments,
  };

  setToCache(cacheKey, report);
  return report;
}

/**
 * 17. Multi-User Authentication & Profile Services
 */
export async function getCurrentUserProfile(
  supabase: SupabaseClient,
  currentUser?: { id: string; email?: string } | null
): Promise<(UserProfile & { member_name?: string }) | null> {
  let user = currentUser;
  if (!user) {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return null;
    user = authData.user;
  }

  const cacheKey = `user_profile_${user.id}`;
  const cached = getFromCache<UserProfile & { member_name?: string }>(cacheKey);
  if (cached) return cached;

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  let role: UserRole = "member";
  let memberId: string | null = null;
  let memberName: string | undefined;

  if (profErr || !profile) {
    role = user.email?.toLowerCase().includes("admin") ? "admin" : "member";
  } else {
    role = (profile.role as UserRole) || (user.email?.toLowerCase().includes("admin") ? "admin" : "member");
    memberId = profile.member_id || null;
  }

  // If memberId is null and role is member, try resolving via members table
  if (!memberId && role === "member") {
    const { data: matchedMember } = await supabase
      .from("members")
      .select("id, name")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .limit(1)
      .maybeSingle();

    if (matchedMember) {
      memberId = matchedMember.id;
      memberName = matchedMember.name;
    }
  } else if (memberId) {
    const { data: memberData } = await supabase
      .from("members")
      .select("name")
      .eq("id", memberId)
      .single();
    if (memberData) {
      memberName = memberData.name;
    }
  }

  const result: UserProfile & { member_name?: string } = {
    id: user.id,
    email: user.email || "",
    role,
    member_id: memberId,
    member_name: memberName,
    created_at: profile?.created_at || new Date().toISOString(),
  };

  setToCache(cacheKey, result);
  return result;
}

/**
 * 18. Member Personal Statement (For authenticated Member role)
 */
export async function getMemberPersonalStatement(
  supabase: SupabaseClient,
  memberId: string,
  startDate?: string,
  endDate?: string
): Promise<MemberPersonalStatement | null> {
  const cacheKey = `member_statement_${memberId}_${startDate || "all"}_${endDate || "all"}`;
  const cached = getFromCache<MemberPersonalStatement>(cacheKey);
  if (cached) return cached;

  const [memberRes, mealsRes, depositsRes] = await Promise.all([
    supabase.from("members").select("*").eq("id", memberId).single(),
    supabase.from("meal_entries").select("*").eq("member_id", memberId),
    supabase.from("deposits").select("*").eq("member_id", memberId).order("deposit_date", { ascending: false }),
  ]);

  if (memberRes.error || !memberRes.data) {
    return null;
  }

  const member: Member = memberRes.data;
  const rawMeals: MealEntry[] = (mealsRes.data || []).map((m) => ({
    ...m,
    unit_price: Number(m.unit_price),
    quantity: Number(m.quantity),
  }));
  const deposits: Deposit[] = (depositsRes.data || []).map((d) => ({
    ...d,
    amount: Number(d.amount),
  }));

  // Filter meals & deposits if period given
  const filteredMeals = rawMeals.filter((m) => {
    if (startDate && m.meal_date < startDate) return false;
    if (endDate && m.meal_date > endDate) return false;
    return true;
  });

  const filteredDeposits = deposits.filter((d) => {
    if (startDate && d.deposit_date < startDate) return false;
    if (endDate && d.deposit_date > endDate) return false;
    return true;
  });

  // Calculate daily grouped meals
  const dailyMealMap = new Map<
    string,
    { lunch: number; dinner: number; cost: number; unit_price: number }
  >();

  for (const m of filteredMeals) {
    const existing = dailyMealMap.get(m.meal_date) || { lunch: 0, dinner: 0, cost: 0, unit_price: m.unit_price };
    if (m.session === "lunch") existing.lunch += m.quantity;
    if (m.session === "dinner") existing.dinner += m.quantity;
    existing.cost += m.quantity * m.unit_price;
    existing.unit_price = m.unit_price;
    dailyMealMap.set(m.meal_date, existing);
  }

  const dailyMeals = Array.from(dailyMealMap.entries())
    .map(([date, data]) => ({
      meal_date: date,
      day_name: getWeekdayName(date),
      is_friday: isFridayDate(date),
      lunch: data.lunch,
      dinner: data.dinner,
      total_meals: data.lunch + data.dinner,
      unit_price: data.unit_price,
      cost: data.cost,
    }))
    .sort((a, b) => b.meal_date.localeCompare(a.meal_date));

  // Lifetime metrics
  const totalLifetimeDeposited = deposits.reduce((acc, d) => acc + d.amount, 0);
  const totalLifetimeMealCost = rawMeals.reduce(
    (acc, m) => acc + (m.quantity > 0 ? m.quantity * m.unit_price : 0),
    0
  );
  const currentBalance = totalLifetimeDeposited - totalLifetimeMealCost;

  let totalLunch = 0;
  let totalDinner = 0;
  for (const m of filteredMeals) {
    if (m.session === "lunch") totalLunch += m.quantity;
    if (m.session === "dinner") totalDinner += m.quantity;
  }

  const periodCost = filteredMeals.reduce((acc, m) => acc + m.quantity * m.unit_price, 0);
  const periodDeposited = filteredDeposits.reduce((acc, d) => acc + d.amount, 0);

  const result: MemberPersonalStatement = {
    member,
    summary: {
      total_meals: totalLunch + totalDinner,
      total_lunch: totalLunch,
      total_dinner: totalDinner,
      total_meal_cost: periodCost,
      total_deposited: totalLifetimeDeposited,
      period_deposited: periodDeposited,
      balance: currentBalance,
    },
    dailyMeals,
    deposits: filteredDeposits,
  };

  setToCache(cacheKey, result);
  return result;
}

/**
 * 19. Group Aggregate Ledger (Strictly excludes individual member details)
 */
export async function getGroupAggregateLedger(
  supabase: SupabaseClient,
  startDate?: string,
  endDate?: string
): Promise<GroupAggregateReport> {
  const cacheKey = `group_aggregate_${startDate || "all"}_${endDate || "all"}`;
  const cached = getFromCache<GroupAggregateReport>(cacheKey);
  if (cached) return cached;

  // First try the secure PostgreSQL SECURITY DEFINER function
  const { data: rpcData, error: rpcErr } = await supabase.rpc("get_group_aggregate_ledger", {
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (!rpcErr && rpcData) {
    const rpcResult = rpcData as GroupAggregateReport;
    setToCache(cacheKey, rpcResult);
    return rpcResult;
  }

  // Fallback if RPC is not yet executed in database (computes aggregate totals without member names)
  const [mealsRes, depositsRes, membersRes] = await Promise.all([
    supabase.from("meal_entries").select("meal_date, session, quantity, unit_price"),
    supabase.from("deposits").select("deposit_date, amount"),
    supabase.from("members").select("id, status"),
  ]);

  const meals = (mealsRes.data || []).map((m) => ({
    ...m,
    quantity: Number(m.quantity),
    unit_price: Number(m.unit_price),
  }));
  const deposits = (depositsRes.data || []).map((d) => ({
    ...d,
    amount: Number(d.amount),
  }));

  const activeCount = (membersRes.data || []).filter((m) => m.status === "active").length;

  const datesMap = new Map<
    string,
    { lunch_count: number; dinner_count: number; total_meals: number; total_cost: number; total_deposit: number }
  >();

  for (const m of meals) {
    if (startDate && m.meal_date < startDate) continue;
    if (endDate && m.meal_date > endDate) continue;
    if (m.quantity <= 0) continue;

    const row = datesMap.get(m.meal_date) || { lunch_count: 0, dinner_count: 0, total_meals: 0, total_cost: 0, total_deposit: 0 };
    if (m.session === "lunch") row.lunch_count += m.quantity;
    if (m.session === "dinner") row.dinner_count += m.quantity;
    row.total_meals += m.quantity;
    row.total_cost += m.quantity * m.unit_price;
    datesMap.set(m.meal_date, row);
  }

  for (const d of deposits) {
    if (startDate && d.deposit_date < startDate) continue;
    if (endDate && d.deposit_date > endDate) continue;

    const row = datesMap.get(d.deposit_date) || { lunch_count: 0, dinner_count: 0, total_meals: 0, total_cost: 0, total_deposit: 0 };
    row.total_deposit += d.amount;
    datesMap.set(d.deposit_date, row);
  }

  const daily_rows = Array.from(datesMap.entries())
    .map(([date, d]) => ({
      meal_date: date,
      day_name: getWeekdayName(date),
      is_friday: isFridayDate(date),
      ...d,
    }))
    .sort((a, b) => b.meal_date.localeCompare(a.meal_date));

  const totalPeriodMeals = daily_rows.reduce((acc, r) => acc + r.total_meals, 0);
  const totalPeriodLunch = daily_rows.reduce((acc, r) => acc + r.lunch_count, 0);
  const totalPeriodDinner = daily_rows.reduce((acc, r) => acc + r.dinner_count, 0);
  const totalPeriodCost = daily_rows.reduce((acc, r) => acc + r.total_cost, 0);
  const totalPeriodDeposit = daily_rows.reduce((acc, r) => acc + r.total_deposit, 0);

  const totalLifetimeDeposits = deposits.reduce((acc, d) => acc + d.amount, 0);
  const totalLifetimeExpenses = meals.reduce((acc, m) => acc + (m.quantity > 0 ? m.quantity * m.unit_price : 0), 0);

  const report: GroupAggregateReport = {
    period: {
      startDate,
      endDate,
      total_meals: totalPeriodMeals,
      total_lunch: totalPeriodLunch,
      total_dinner: totalPeriodDinner,
      total_cost: totalPeriodCost,
      total_deposit: totalPeriodDeposit,
    },
    lifetime: {
      total_deposits: totalLifetimeDeposits,
      total_expenses: totalLifetimeExpenses,
      balance: totalLifetimeDeposits - totalLifetimeExpenses,
      active_members_count: activeCount,
    },
    daily_rows,
  };

  setToCache(cacheKey, report);
  return report;
}
