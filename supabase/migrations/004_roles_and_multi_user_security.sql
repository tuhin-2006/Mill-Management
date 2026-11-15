-- ==============================================================================
-- Migration: 004_roles_and_multi_user_security.sql
-- Project: Personal Mill Management System
-- Purpose:
--   1. Add role & member_id to profiles table for multi-user authentication.
--   2. Add user_id to members table for linking auth accounts.
--   3. Implement strict Row Level Security (RLS) policies for:
--      - ADMIN: Full access to all tables & operations.
--      - MEMBER: Read-only access strictly to their own member record, meals,
--                deposits, and adjustments. Zero access to other members.
--      - GROUP_LEDGER_VIEWER: Complete isolation from individual records.
--   4. Implement a secure SECURITY DEFINER function for Group Ledger Viewer
--      that returns date-aggregated financial statistics with ZERO member info.
-- ==============================================================================

-- 1. Extend profiles table with role and member association
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
CHECK (role IN ('admin', 'member', 'group_ledger_viewer'));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE SET NULL;

-- 2. Extend members table with user_id
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ensure unique constraint so one auth user can only link to one member
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_member_user_id'
  ) THEN
    ALTER TABLE public.members ADD CONSTRAINT unique_member_user_id UNIQUE (user_id);
  END IF;
END $$;

-- 3. Default existing profiles: ensure at least one admin exists
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email ILIKE '%admin%' OR email ILIKE '%tuhin%'
);

-- If no admin exists yet, make the earliest created profile admin
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin');

-- 4. Helper functions for RLS (SECURITY DEFINER, fixed search_path)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'member');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_user_member_id()
RETURNS UUID AS $$
DECLARE
  v_member_id UUID;
BEGIN
  SELECT member_id INTO v_member_id FROM public.profiles WHERE id = auth.uid();
  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 5. Update user creation trigger to automatically assign role and member_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_member_id UUID;
  v_role TEXT := 'member';
BEGIN
  -- Match member by email if present
  SELECT id INTO v_member_id
  FROM public.members
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

  -- Default admin if email contains admin
  IF NEW.email ILIKE '%admin%' THEN
    v_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, email, role, member_id)
  VALUES (NEW.id, NEW.email, v_role, v_member_id)
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      member_id = COALESCE(public.profiles.member_id, EXCLUDED.member_id);

  -- Link user_id back to members table
  IF v_member_id IS NOT NULL THEN
    UPDATE public.members
    SET user_id = NEW.id
    WHERE id = v_member_id AND (user_id IS NULL OR user_id = NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 6. STRICT ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- A. PROFILES TABLE
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Admin can manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- B. MEMBERS TABLE
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage members" ON public.members;
DROP POLICY IF EXISTS "Admin can manage all members" ON public.members;
DROP POLICY IF EXISTS "Member can view own member record" ON public.members;
DROP POLICY IF EXISTS "Viewer can view member status count" ON public.members;

CREATE POLICY "Admin can manage all members" ON public.members
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Member can view own member record" ON public.members
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'member' 
    AND id = public.current_user_member_id()
  );

-- C. MEAL ENTRIES TABLE
ALTER TABLE public.meal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage meal_entries" ON public.meal_entries;
DROP POLICY IF EXISTS "Admin can manage all meal_entries" ON public.meal_entries;
DROP POLICY IF EXISTS "Member can view own meal_entries" ON public.meal_entries;

CREATE POLICY "Admin can manage all meal_entries" ON public.meal_entries
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Member can view own meal_entries" ON public.meal_entries
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'member' 
    AND member_id = public.current_user_member_id()
  );

-- D. DEPOSITS TABLE
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage deposits" ON public.deposits;
DROP POLICY IF EXISTS "Admin can manage all deposits" ON public.deposits;
DROP POLICY IF EXISTS "Member can view own deposits" ON public.deposits;

CREATE POLICY "Admin can manage all deposits" ON public.deposits
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Member can view own deposits" ON public.deposits
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'member' 
    AND member_id = public.current_user_member_id()
  );

-- E. ADJUSTMENTS TABLE
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage adjustments" ON public.adjustments;
DROP POLICY IF EXISTS "Admin can manage all adjustments" ON public.adjustments;
DROP POLICY IF EXISTS "Member can view own adjustments" ON public.adjustments;

CREATE POLICY "Admin can manage all adjustments" ON public.adjustments
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Member can view own adjustments" ON public.adjustments
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'member' 
    AND member_id = public.current_user_member_id()
  );

-- F. SETTINGS TABLE
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Admin can manage settings" ON public.settings;
DROP POLICY IF EXISTS "All authenticated users can read settings" ON public.settings;

CREATE POLICY "Admin can manage settings" ON public.settings
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "All authenticated users can read settings" ON public.settings
  FOR SELECT TO authenticated
  USING (true);

-- G. EMAIL LOGS TABLE
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "Admin can manage email_logs" ON public.email_logs;

CREATE POLICY "Admin can manage email_logs" ON public.email_logs
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ==============================================================================
-- 7. SECURE AGGREGATE-ONLY FUNCTION FOR GROUP LEDGER VIEWER
-- Strictly excludes individual member names, IDs, quantities, and balances.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_group_aggregate_ledger(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_role TEXT;
  result JSONB;
BEGIN
  v_role := public.current_user_role();
  IF v_role NOT IN ('admin', 'group_ledger_viewer') THEN
    RAISE EXCEPTION 'Access denied. Only admin or group_ledger_viewer may access aggregate ledger.';
  END IF;

  WITH period_meals AS (
    SELECT
      meal_date,
      SUM(CASE WHEN session = 'lunch' THEN quantity ELSE 0 END) AS lunch_count,
      SUM(CASE WHEN session = 'dinner' THEN quantity ELSE 0 END) AS dinner_count,
      SUM(quantity) AS total_meals,
      SUM(quantity * unit_price) AS total_cost
    FROM public.meal_entries
    WHERE (p_start_date IS NULL OR meal_date >= p_start_date)
      AND (p_end_date IS NULL OR meal_date <= p_end_date)
      AND quantity > 0
    GROUP BY meal_date
  ),
  period_deposits AS (
    SELECT
      deposit_date,
      SUM(amount) AS deposit_amount
    FROM public.deposits
    WHERE (p_start_date IS NULL OR deposit_date >= p_start_date)
      AND (p_end_date IS NULL OR deposit_date <= p_end_date)
    GROUP BY deposit_date
  ),
  all_dates AS (
    SELECT meal_date AS d FROM period_meals
    UNION
    SELECT deposit_date AS d FROM period_deposits
  ),
  daily_rows AS (
    SELECT
      ad.d AS meal_date,
      TO_CHAR(ad.d, 'FMDay') AS day_name,
      EXTRACT(DOW FROM ad.d) = 5 AS is_friday,
      COALESCE(pm.lunch_count, 0) AS lunch_count,
      COALESCE(pm.dinner_count, 0) AS dinner_count,
      COALESCE(pm.total_meals, 0) AS total_meals,
      COALESCE(pm.total_cost, 0) AS total_cost,
      COALESCE(pd.deposit_amount, 0) AS total_deposit
    FROM all_dates ad
    LEFT JOIN period_meals pm ON pm.meal_date = ad.d
    LEFT JOIN period_deposits pd ON pd.deposit_date = ad.d
    ORDER BY ad.d DESC
  ),
  lifetime_stats AS (
    SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM public.deposits) AS total_lifetime_deposits,
      (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM public.meal_entries WHERE quantity > 0) AS total_lifetime_expenses,
      (SELECT COUNT(*) FROM public.members WHERE status = 'active') AS active_members_count
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'startDate', p_start_date,
      'endDate', p_end_date,
      'total_meals', COALESCE((SELECT SUM(total_meals) FROM daily_rows), 0),
      'total_lunch', COALESCE((SELECT SUM(lunch_count) FROM daily_rows), 0),
      'total_dinner', COALESCE((SELECT SUM(dinner_count) FROM daily_rows), 0),
      'total_cost', COALESCE((SELECT SUM(total_cost) FROM daily_rows), 0),
      'total_deposit', COALESCE((SELECT SUM(total_deposit) FROM daily_rows), 0)
    ),
    'lifetime', jsonb_build_object(
      'total_deposits', ls.total_lifetime_deposits,
      'total_expenses', ls.total_lifetime_expenses,
      'balance', (ls.total_lifetime_deposits - ls.total_lifetime_expenses),
      'active_members_count', ls.active_members_count
    ),
    'daily_rows', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM daily_rows r), '[]'::jsonb)
  ) INTO result
  FROM lifetime_stats ls;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
