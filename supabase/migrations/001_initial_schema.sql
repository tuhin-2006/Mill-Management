-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Project: Mill Management System
-- Description: Core tables, constraints, indexes, RLS policies, and initial seeds.
-- ==============================================================================

-- 1. Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Settings Table (Single row configuration)
CREATE TABLE IF NOT EXISTS public.settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    app_name TEXT NOT NULL DEFAULT 'Mill Manager',
    meal_price DECIMAL(10, 2) NOT NULL DEFAULT 60.00 CHECK (meal_price >= 0),
    friday_meal_price DECIMAL(10, 2) NOT NULL DEFAULT 120.00 CHECK (friday_meal_price >= 0),
    currency TEXT NOT NULL DEFAULT 'BDT',
    timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    friday_dinner_disabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for settings updated_at
DROP TRIGGER IF EXISTS trigger_settings_updated_at ON public.settings;
CREATE TRIGGER trigger_settings_updated_at
    BEFORE UPDATE ON public.settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed default settings
INSERT INTO public.settings (id, app_name, meal_price, friday_meal_price, currency, timezone, friday_dinner_disabled)
VALUES (1, 'Mill Manager', 60.00, 120.00, 'BDT', 'Asia/Dhaka', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Profiles Table (Linked to auth.users for admin)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Members Table (The 4 mess/mill members)
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for members updated_at
DROP TRIGGER IF EXISTS trigger_members_updated_at ON public.members;
CREATE TRIGGER trigger_members_updated_at
    BEFORE UPDATE ON public.members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed initial 4 members if table is empty
INSERT INTO public.members (name, status)
SELECT name, 'active' FROM (VALUES
    ('Tuhin'),
    ('Rahim'),
    ('Karim'),
    ('Hasan')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM public.members);

-- 5. Meal Entries Table
-- Each entry represents one member's participation in a session on a date
CREATE TABLE IF NOT EXISTS public.meal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
    meal_date DATE NOT NULL,
    session TEXT NOT NULL CHECK (session IN ('lunch', 'dinner')),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_member_meal_session UNIQUE (member_id, meal_date, session)
);

-- Trigger for meal_entries updated_at
DROP TRIGGER IF EXISTS trigger_meal_entries_updated_at ON public.meal_entries;
CREATE TRIGGER trigger_meal_entries_updated_at
    BEFORE UPDATE ON public.meal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for fast querying by date and member
CREATE INDEX IF NOT EXISTS idx_meal_entries_meal_date ON public.meal_entries(meal_date);
CREATE INDEX IF NOT EXISTS idx_meal_entries_member_date ON public.meal_entries(member_id, meal_date);

-- 6. Deposits Table
CREATE TABLE IF NOT EXISTS public.deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    deposit_date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for deposits updated_at
DROP TRIGGER IF EXISTS trigger_deposits_updated_at ON public.deposits;
CREATE TRIGGER trigger_deposits_updated_at
    BEFORE UPDATE ON public.deposits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for deposits
CREATE INDEX IF NOT EXISTS idx_deposits_member_id ON public.deposits(member_id);
CREATE INDEX IF NOT EXISTS idx_deposits_deposit_date ON public.deposits(deposit_date);

-- 7. Adjustments Table (For balance additions/deductions)
CREATE TABLE IF NOT EXISTS public.adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE RESTRICT,
    amount DECIMAL(10, 2) NOT NULL,
    adjustment_date DATE NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_member_id ON public.adjustments(member_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_date ON public.adjustments(adjustment_date);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict personal system: Authenticated users have full access; Public has none.
-- ==============================================================================

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;

-- Settings RLS
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON public.settings;
DROP POLICY IF EXISTS "Authenticated users can manage settings" ON public.settings;
CREATE POLICY "Authenticated users can manage settings" ON public.settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Profiles RLS
DROP POLICY IF EXISTS "Authenticated users can manage profiles" ON public.profiles;
CREATE POLICY "Authenticated users can manage profiles" ON public.profiles
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Optional trigger to auto-create profile on auth.users signup & backfill
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing users into profiles
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Members RLS
DROP POLICY IF EXISTS "Authenticated users can manage members" ON public.members;
CREATE POLICY "Authenticated users can manage members" ON public.members
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Meal Entries RLS
DROP POLICY IF EXISTS "Authenticated users can manage meal_entries" ON public.meal_entries;
CREATE POLICY "Authenticated users can manage meal_entries" ON public.meal_entries
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Deposits RLS
DROP POLICY IF EXISTS "Authenticated users can manage deposits" ON public.deposits;
CREATE POLICY "Authenticated users can manage deposits" ON public.deposits
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Adjustments RLS
DROP POLICY IF EXISTS "Authenticated users can manage adjustments" ON public.adjustments;
CREATE POLICY "Authenticated users can manage adjustments" ON public.adjustments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
