/**
 * Global TypeScript domain interfaces for Personal Mill Management System.
 */

export type Nullable<T> = T | null;

export type MealSession = "lunch" | "dinner";
export type MemberStatus = "active" | "inactive";

export type UserRole = "admin" | "member" | "group_ledger_viewer";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  member_id?: string | null;
  created_at: string;
}

export interface Settings {
  id: number;
  app_name: string;
  meal_price: number;
  friday_meal_price: number;
  currency: string;
  timezone: string;
  friday_dinner_disabled: boolean;
  group_ledger_viewer_email?: string | null;
  updated_at: string;
}

export interface Member {
  id: string;
  name: string;
  status: MemberStatus;
  email?: string | null;
  user_id?: string | null;
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

export interface PeriodMemberStatement {
  member_id: string;
  member_name: string;
  status: MemberStatus;
  // Opening / Previous before startDate
  previous_cost: number;
  previous_deposit: number;
  previous_balance: number; // deposit - cost
  previous_unpaid: number; // if balance < 0, abs(balance)
  // Current Selected Period Activity
  period_meals: number;
  period_lunch: number;
  period_dinner: number;
  period_cost: number;
  period_deposit: number;
  period_net: number; // period_deposit - period_cost
  // Closing Cumulative at endDate
  closing_balance: number; // previous_balance + period_deposit - period_cost
  closing_unpaid: number; // if balance < 0, abs(balance)
}

export interface PeriodLedgerReport {
  startDate?: string;
  endDate?: string;
  // Opening / Previous before startDate
  opening: {
    total_meals: number;
    total_cost: number;
    total_deposit: number;
    balance: number; // deposit - cost
    unpaid: number; // if balance < 0, abs(balance)
    advance: number; // if balance >= 0, balance
  };
  // Current Period Activity
  period: {
    total_meals: number;
    lunch_count: number;
    dinner_count: number;
    total_cost: number;
    total_deposit: number;
    net_flow: number; // deposit - cost
    active_days: number;
  };
  // Closing Cumulative
  closing: {
    total_cost: number;
    total_deposit: number;
    balance: number;
    unpaid: number;
    advance: number;
  };
  dailyRows: DailyLedgerRow[];
  memberStatements: PeriodMemberStatement[];
}

export type EmailDeliveryStatus = "sent" | "failed" | "skipped_duplicate";
export type EmailRecipientType = "member" | "group_viewer" | "test";

export interface EmailLog {
  id: string;
  report_period_start: string;
  report_period_end: string;
  recipient_type: EmailRecipientType;
  recipient_email: string;
  member_id?: string | null;
  status: EmailDeliveryStatus;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
  sent_at: string;
  created_at: string;
  member?: Member;
}

export interface GroupAggregateReport {
  period: {
    startDate?: string | null;
    endDate?: string | null;
    total_meals: number;
    total_lunch: number;
    total_dinner: number;
    total_cost: number;
    total_deposit: number;
  };
  lifetime: {
    total_deposits: number;
    total_expenses: number;
    balance: number;
    active_members_count: number;
  };
  daily_rows: Array<{
    meal_date: string;
    day_name: string;
    is_friday: boolean;
    lunch_count: number;
    dinner_count: number;
    total_meals: number;
    total_cost: number;
    total_deposit: number;
  }>;
}

export interface MemberPersonalStatement {
  member: Member;
  summary: {
    total_meals: number;
    total_lunch: number;
    total_dinner: number;
    total_meal_cost: number;
    total_deposited: number;
    balance: number;
  };
  dailyMeals: Array<{
    meal_date: string;
    day_name: string;
    is_friday: boolean;
    lunch: number;
    dinner: number;
    total_meals: number;
    unit_price: number;
    cost: number;
  }>;
  deposits: Array<{
    id: string;
    amount: number;
    deposit_date: string;
    note?: string | null;
  }>;
}



