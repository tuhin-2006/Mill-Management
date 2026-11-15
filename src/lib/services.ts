import { SupabaseClient } from "@supabase/supabase-js";
import {
  Member,
  MealEntry,
  Deposit,
  Settings,
  MemberSummary,
  GroupSummary,
  DailyLedgerRow,
} from "@/types";
import { getTodayInDhaka, getWeekdayName, isFridayDate } from "@/lib/date";

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
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...data,
    meal_price: Number(data.meal_price),
    friday_meal_price: data.friday_meal_price != null ? Number(data.friday_meal_price) : 120.0,
  };
}

/**
 * 2. Update system settings
 */
export async function updateSettings(
  supabase: SupabaseClient,
  updates: Partial<Omit<Settings, "id" | "updated_at">>
): Promise<Settings> {
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

  return {
    ...data,
    meal_price: Number(data.meal_price),
    friday_meal_price:
      data.friday_meal_price != null
        ? Number(data.friday_meal_price)
        : updates.friday_meal_price != null
        ? Number(updates.friday_meal_price)
        : 120.0,
  };
}

/**
 * 3. Fetch all members
 */
export async function getMembers(supabase: SupabaseClient): Promise<Member[]> {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  return data || [];
}

/**
 * 4. Add a new member
 */
export async function addMember(
  supabase: SupabaseClient,
  name: string
): Promise<Member> {
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
}

/**
 * 8. Delete daily meal entries for a given date
 */
export async function deleteDailyMeals(
  supabase: SupabaseClient,
  dateString: string
): Promise<void> {
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
  const { data, error } = await supabase
    .from("deposits")
    .select("*, member:members(*)")
    .order("deposit_date", { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(`Failed to fetch deposits: ${error.message}`);
  }

  return (data || []).map((d) => ({
    ...d,
    amount: Number(d.amount),
  }));
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
  const { error } = await supabase.from("deposits").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete deposit: ${error.message}`);
  }
}

/**
 * 13. Comprehensive Group & Member Financial Summary
 */
export async function getGroupSummary(
  supabase: SupabaseClient
): Promise<GroupSummary> {
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
