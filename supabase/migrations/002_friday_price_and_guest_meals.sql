-- ==============================================================================
-- Migration: 002_friday_price_and_guest_meals.sql
-- Project: Personal Mill Management System
-- Purpose:
--   1. Add friday_meal_price to settings (default 120 BDT)
--   2. Update meal_entries quantity constraint to allow guest meals (quantity >= 0)
-- ==============================================================================

-- 1. Add Friday meal price column to settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS friday_meal_price DECIMAL(10, 2) NOT NULL DEFAULT 120.00;

-- 2. Allow guest and extra meals (quantity >= 0)
ALTER TABLE public.meal_entries 
DROP CONSTRAINT IF EXISTS meal_entries_quantity_check;

ALTER TABLE public.meal_entries 
ADD CONSTRAINT meal_entries_quantity_check CHECK (quantity >= 0);
