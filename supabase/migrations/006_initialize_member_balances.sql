-- ==============================================================================
-- Migration: 006_initialize_member_balances.sql
-- Project: Mill Management System
-- Description: Sets initial balances dated 15 November 2026 for existing members
--              and updates aggregate RPC to include adjustments in balance calculations.
-- ==============================================================================

-- 1. Insert Initial Balances (Idempotent: prevents duplicate initialization)
DO $$
DECLARE
  v_sohel_id UUID;
  v_rubel_id UUID;
  v_niloy_id UUID;
  v_tuhin_id UUID;
BEGIN
  SELECT id INTO v_sohel_id FROM public.members WHERE name ILIKE '%Sohel%' LIMIT 1;
  SELECT id INTO v_rubel_id FROM public.members WHERE name ILIKE '%Rubel%' LIMIT 1;
  SELECT id INTO v_niloy_id FROM public.members WHERE name ILIKE '%Niloy%' LIMIT 1;
  SELECT id INTO v_tuhin_id FROM public.members WHERE name ILIKE '%Tuhin%' LIMIT 1;

  IF v_sohel_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.adjustments WHERE member_id = v_sohel_id AND note ILIKE '%initial balance%'
  ) THEN
    INSERT INTO public.adjustments (member_id, amount, adjustment_date, note)
    VALUES (v_sohel_id, 260.00, '2026-11-15', 'Initial Balance (15 Nov 2026)');
  END IF;

  IF v_rubel_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.adjustments WHERE member_id = v_rubel_id AND note ILIKE '%initial balance%'
  ) THEN
    INSERT INTO public.adjustments (member_id, amount, adjustment_date, note)
    VALUES (v_rubel_id, 140.00, '2026-11-15', 'Initial Balance (15 Nov 2026)');
  END IF;

  IF v_niloy_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.adjustments WHERE member_id = v_niloy_id AND note ILIKE '%initial balance%'
  ) THEN
    INSERT INTO public.adjustments (member_id, amount, adjustment_date, note)
    VALUES (v_niloy_id, -1330.00, '2026-11-15', 'Initial Balance (15 Nov 2026)');
  END IF;

  IF v_tuhin_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.adjustments WHERE member_id = v_tuhin_id AND note ILIKE '%initial balance%'
  ) THEN
    INSERT INTO public.adjustments (member_id, amount, adjustment_date, note)
    VALUES (v_tuhin_id, -390.00, '2026-11-15', 'Initial Balance (15 Nov 2026)');
  END IF;
END $$;

-- 2. Update get_group_aggregate_ledger to seamlessly include adjustments in running balance
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
  period_adjustments AS (
    SELECT
      adjustment_date,
      SUM(amount) AS adjustment_amount
    FROM public.adjustments
    WHERE (p_start_date IS NULL OR adjustment_date >= p_start_date)
      AND (p_end_date IS NULL OR adjustment_date <= p_end_date)
    GROUP BY adjustment_date
  ),
  all_dates AS (
    SELECT meal_date AS d FROM period_meals
    UNION
    SELECT deposit_date AS d FROM period_deposits
    UNION
    SELECT adjustment_date AS d FROM period_adjustments
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
      COALESCE(pd.deposit_amount, 0) + COALESCE(pa.adjustment_amount, 0) AS total_deposit
    FROM all_dates ad
    LEFT JOIN period_meals pm ON pm.meal_date = ad.d
    LEFT JOIN period_deposits pd ON pd.deposit_date = ad.d
    LEFT JOIN period_adjustments pa ON pa.adjustment_date = ad.d
    ORDER BY ad.d DESC
  ),
  lifetime_stats AS (
    SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM public.deposits) AS total_lifetime_deposits,
      (SELECT COALESCE(SUM(amount), 0) FROM public.adjustments) AS total_lifetime_adjustments,
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
      'total_deposits', (ls.total_lifetime_deposits + ls.total_lifetime_adjustments),
      'total_expenses', ls.total_lifetime_expenses,
      'balance', (ls.total_lifetime_deposits + ls.total_lifetime_adjustments - ls.total_lifetime_expenses),
      'active_members_count', ls.active_members_count
    ),
    'daily_rows', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM daily_rows r), '[]'::jsonb)
  ) INTO result
  FROM lifetime_stats ls;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
