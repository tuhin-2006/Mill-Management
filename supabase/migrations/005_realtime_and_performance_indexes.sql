-- ==============================================================================
-- Migration: 005_realtime_and_performance_indexes.sql
-- Project: Mill Management System
-- Description: Enables Supabase Realtime publication for tables and creates
--              composite performance indexes for high-speed range queries.
-- ==============================================================================

-- 1. Enable Supabase Realtime publication on relevant tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Add tables to the realtime publication
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_entries;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.deposits;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 2. Performance Composite Indexes for Fast Query Execution
-- Faster meal queries by session, date, and member
CREATE INDEX IF NOT EXISTS idx_meal_entries_date_session
  ON public.meal_entries(meal_date, session);

CREATE INDEX IF NOT EXISTS idx_meal_entries_member_session_date
  ON public.meal_entries(member_id, session, meal_date);

-- Faster deposit queries by date descending and member
CREATE INDEX IF NOT EXISTS idx_deposits_date_desc
  ON public.deposits(deposit_date DESC);

CREATE INDEX IF NOT EXISTS idx_deposits_member_date_desc
  ON public.deposits(member_id, deposit_date DESC);

-- Faster profile lookups by user and member ID
CREATE INDEX IF NOT EXISTS idx_profiles_member_id
  ON public.profiles(member_id);

CREATE INDEX IF NOT EXISTS idx_members_user_id
  ON public.members(user_id);

-- Set REPLICA IDENTITY FULL on tables so old records are available on UPDATE/DELETE
ALTER TABLE public.meal_entries REPLICA IDENTITY FULL;
ALTER TABLE public.deposits REPLICA IDENTITY FULL;
ALTER TABLE public.members REPLICA IDENTITY FULL;
ALTER TABLE public.settings REPLICA IDENTITY FULL;
