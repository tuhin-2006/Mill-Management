"use client";

import * as React from "react";
import { Copy, Check, Database, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const INITIAL_SQL_MIGRATION = `-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Project: Personal Mill Management System
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
INSERT INTO public.settings (id, app_name, meal_price, currency, timezone, friday_dinner_disabled)
VALUES (1, 'Mill Manager', 60.00, 'BDT', 'Asia/Dhaka', true)
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
CREATE TABLE IF NOT EXISTS public.meal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
    meal_date DATE NOT NULL,
    session TEXT NOT NULL CHECK (session IN ('lunch', 'dinner')),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity IN (0, 1)),
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

-- Indexes for fast querying
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

CREATE INDEX IF NOT EXISTS idx_deposits_member_id ON public.deposits(member_id);
CREATE INDEX IF NOT EXISTS idx_deposits_deposit_date ON public.deposits(deposit_date);

-- 7. Adjustments Table
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

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage settings" ON public.settings;
CREATE POLICY "Authenticated users can manage settings" ON public.settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage profiles" ON public.profiles;
CREATE POLICY "Authenticated users can manage profiles" ON public.profiles
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

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

INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can manage members" ON public.members;
CREATE POLICY "Authenticated users can manage members" ON public.members
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage meal_entries" ON public.meal_entries;
CREATE POLICY "Authenticated users can manage meal_entries" ON public.meal_entries
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage deposits" ON public.deposits;
CREATE POLICY "Authenticated users can manage deposits" ON public.deposits
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage adjustments" ON public.adjustments;
CREATE POLICY "Authenticated users can manage adjustments" ON public.adjustments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
`;

export function MigrationAlert({ isTableMissing }: { isTableMissing: boolean }) {
  const [copied, setCopied] = React.useState(false);

  if (!isTableMissing) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(INITIAL_SQL_MIGRATION);
    setCopied(true);
    toast.success("Complete SQL migration script copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-foreground mb-6 shadow-sm">
      <div className="flex items-start gap-3.5">
        <div className="rounded-lg bg-amber-500/20 p-2.5 text-amber-600 dark:text-amber-400 shrink-0">
          <Database className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Database Setup Required (সুপাবেস ডেটাবেস টেবিল তৈরি করা প্রয়োজন)
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            সুপাবেসে এখনও প্রয়োজনীয় টেবিলগুলো (<code className="font-mono text-xs">members</code>,{" "}
            <code className="font-mono text-xs">meal_entries</code>,{" "}
            <code className="font-mono text-xs">deposits</code>,{" "}
            <code className="font-mono text-xs">settings</code>) তৈরি করা হয়নি। নিচের বাটনে ক্লিক করে সম্পূর্ণ SQL স্ক্রিপ্ট কপি করে Supabase SQL Editor-এ একবার Run করলেই সব স্বয়ংক্রিয়ভাবে প্রস্তুত হয়ে যাবে।
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCopy}
              className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "SQL Copied to Clipboard!" : "Copy Full SQL Script"}
            </Button>

            <a
              href="https://supabase.com/dashboard/project/hnmvuopdpubdlsveojrq/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted/60 transition-colors"
            >
              <span>Open Supabase SQL Editor</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
