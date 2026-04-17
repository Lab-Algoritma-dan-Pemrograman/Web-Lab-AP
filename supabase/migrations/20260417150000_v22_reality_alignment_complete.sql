-- =====================================================
-- Migration: TRIPLE REALITY ALIGNMENT (V22)
-- Resolve: Inventaris 400 (last_checked, quantity)
-- Resolve: Keuangan 400 (date timestamp, amount)
-- Resolve: Smart Assistant Filter (Time-based Availability)
-- =====================================================

-- 0. INFRASTRUCTURE PATCH (Safety)
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS "last_checked" TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS "quantity" INTEGER DEFAULT 1;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS "condition" TEXT DEFAULT 'Baik';
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS "location" TEXT;

-- 1. PURGE OLD SIGNATURES
DO $$ BEGIN
    DROP FUNCTION IF EXISTS public.get_inventory_items_secure(BIGINT);
    DROP FUNCTION IF EXISTS public.get_financial_records_secure(BIGINT);
    DROP FUNCTION IF EXISTS public.get_assistant_availability_secure(BIGINT, TEXT, TIME, TIME);
    DROP FUNCTION IF EXISTS public.upsert_inventory_item_secure(BIGINT, BIGINT, TEXT, TEXT, INTEGER, TEXT);
    DROP FUNCTION IF EXISTS public.upsert_inventory_item_secure(BIGINT, TEXT, TEXT, TEXT, INTEGER, TEXT);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. MODULE: Inventaris (Reality Sync)
CREATE OR REPLACE FUNCTION public.get_inventory_items_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, name TEXT, condition TEXT, quantity INTEGER, location TEXT, last_checked TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ii.id::BIGINT, ii.name::TEXT, ii.condition::TEXT, ii.quantity::INTEGER, ii.location::TEXT, ii.last_checked::TIMESTAMP WITH TIME ZONE
    FROM public.inventory_items ii ORDER BY ii.name ASC;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_inventory_item_secure(p_caller_id BIGINT, p_id TEXT, p_name TEXT, p_condition TEXT, p_quantity INTEGER, p_location TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Akses Ditolak'; END IF;
    IF p_id = '0' OR p_id IS NULL OR p_id = '' THEN
        INSERT INTO public.inventory_items (name, condition, quantity, location, last_checked) VALUES (p_name, p_condition, p_quantity, p_location, now());
    ELSE
        UPDATE public.inventory_items SET name = p_name, condition = p_condition, quantity = p_quantity, location = p_location, last_checked = now() WHERE id::TEXT = p_id;
    END IF;
END; $$;

-- 3. MODULE: Laporan Keuangan (Reality Sync)
CREATE OR REPLACE FUNCTION public.get_financial_records_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, title TEXT, amount NUMERIC, type TEXT, category TEXT, date TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Akses Ditolak'; END IF;
    RETURN QUERY SELECT fr.id::BIGINT, fr.title::TEXT, fr.amount::NUMERIC, fr.type::TEXT, fr.category::TEXT, fr.date::TIMESTAMP WITH TIME ZONE 
    FROM public.financial_records fr ORDER BY fr.date DESC;
END; $$;

-- 4. MODULE: Manajemen Kelas (Smart Assistant Filter)
-- Using assistant_availability table to find eligible staff
CREATE OR REPLACE FUNCTION public.get_assistant_availability_secure(p_viewer_id BIGINT, p_day TEXT, p_start TIME, p_end TIME)
RETURNS TABLE (user_id BIGINT, user_full_name TEXT, user_role TEXT, start_time TIME, end_time TIME)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT u.id::BIGINT, u.full_name::TEXT, u.role::TEXT, aa.start_time::TIME, aa.end_time::TIME
    FROM public.users u
    JOIN public.assistant_availability aa ON u.id = aa.user_id
    WHERE aa.day_of_week = p_day
      AND aa.start_time <= p_start
      AND aa.end_time >= p_end
      AND u.is_active = TRUE;
END; $$;

-- 5. GRANTS
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
GRANT ALL ON TABLE public.inventory_items TO authenticated, service_role, anon;
GRANT ALL ON TABLE public.financial_records TO authenticated, service_role, anon;
GRANT ALL ON TABLE public.assistant_availability TO authenticated, service_role, anon;
