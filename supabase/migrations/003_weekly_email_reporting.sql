-- ==============================================================================
-- Migration: 003_weekly_email_reporting.sql
-- Project: Mill Management System
-- Purpose:
--   1. Add email column to members table for individual weekly reporting.
--   2. Add group_ledger_viewer_email column to settings table.
--   3. Create email_logs table for audit delivery tracking, duplicate prevention,
--      and failure logging.
--   4. Enable RLS and setup secure access policies.
-- ==============================================================================

-- 1. Add email column to members table
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Add Group Ledger Viewer recipient email to settings
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS group_ledger_viewer_email TEXT;

-- 3. Email Logs Table (Tracks all sent, skipped, and failed email reports)
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_period_start DATE NOT NULL,
    report_period_end DATE NOT NULL,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('member', 'group_viewer', 'test')),
    recipient_email TEXT NOT NULL,
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped_duplicate')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance and duplicate detection queries
CREATE INDEX IF NOT EXISTS idx_email_logs_period_recipient
    ON public.email_logs(report_period_start, report_period_end, recipient_email, status);

CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at
    ON public.email_logs(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_member_id
    ON public.email_logs(member_id);

-- 4. Enable Row Level Security (RLS) on email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users (admin) can view and manage email logs
DROP POLICY IF EXISTS "Authenticated users can manage email_logs" ON public.email_logs;
CREATE POLICY "Authenticated users can manage email_logs" ON public.email_logs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger for updated_at or logging consistency if needed
COMMENT ON TABLE public.email_logs IS 'Audit log of weekly email reports sent via Google Apps Script and Edge Function';
