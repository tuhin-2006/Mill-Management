/**
 * Global TypeScript domain interfaces for Personal Mill Management System.
 */

export type Nullable<T> = T | null;

export type MealSession = "lunch" | "dinner";
export type MemberStatus = "active" | "inactive";

export interface Settings {
  id: number;
  app_name: string;
  meal_price: number;
  friday_meal_price: number;
  currency: string;
  timezone: string;
  friday_dinner_disabled: boolean;
  updated_at: string;
}

export interface Member {
  id: string;
  name: string;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
}

export interface MealEntry {
  id: string;
  member_id: string;
  meal_date: string; // YYYY-MM-DD
  session: MealSession;
  quantity: number; // 0 or 1
  unit_price: number;
  created_at: string;
  updated_at: string;
  member?: Member;
}

export interface Deposit {
  id: string;
  member_id: string;
  amount: number;
  deposit_date: string; // YYYY-MM-DD
  note?: string | null;
  created_at: string;
  updated_at: string;
  member?: Member;
}

export interface Adjustment {
  id: string;
  member_id?: string | null;
  amount: number;
  adjustment_date: string;
  note: string;
  created_at: string;
  member?: Member;
}

// Financial and calculation models
export interface MemberSummary {
  id: string;
  name: string;
  status: MemberStatus;
  total_meals: number;
  total_lunch: number;
  total_dinner: number;
  total_meal_cost: number;
  total_deposited: number;
  balance: number;
}

export interface GroupSummary {
  today_date: string;
  today_total_meals: number;
  today_total_cost: number;
  today_lunch_count: number;
  today_dinner_count: number;
  total_group_deposit: number;
  total_group_expense: number;
  remaining_group_balance: number;
  active_members_count: number;
  total_members_count: number;
  member_summaries: MemberSummary[];
}

export interface DailyMealEntryState {
  member_id: string;
  member_name: string;
  lunch: number;
  dinner: number;
  unit_price: number;
}

export interface DailyLedgerRow {
  meal_date: string;
  day_name: string;
  is_friday: boolean;
  lunch_count: number;
  dinner_count: number;
  total_meals: number;
  total_cost: number;
  active_members_ate: number;
}
