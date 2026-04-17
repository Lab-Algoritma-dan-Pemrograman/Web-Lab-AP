-- =====================================================
-- Migration: INVENTORY MASTER REPAIR (V21)
-- Resolve: "column condition does not exist"
-- Resolve: "UUID vs BIGINT Mismatch"
-- =====================================================

-- 1. PATCH TABLE: Add missing columns
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS "condition" TEXT DEFAULT 'Baik';
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS "quantity" INTEGER;

-- 2. AGGRESSIVE PURGE: Remove old signatures
DO $$ BEGIN
    DROP FUNCTION IF EXISTS public.get_inventory_items_secure(BIGINT);
    DROP FUNCTION IF EXISTS public.upsert_inventory_item_secure(BIGINT, BIGINT, TEXT, TEXT, INTEGER, TEXT);
    DROP FUNCTION IF EXISTS public.delete_inventory_item_secure(BIGINT, BIGINT);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. RE-IMPLEMENT: get_inventory_items_secure
-- Returns id as TEXT to safely convey UUID to frontend
CREATE OR REPLACE FUNCTION public.get_inventory_items_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id TEXT, 
    name TEXT, 
    condition TEXT, 
    quantity INTEGER, 
    location TEXT, 
    updated_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT 
        ii.id::TEXT, 
        ii.name::TEXT, 
        ii.condition::TEXT, 
        COALESCE(ii.quantity, ii.total_quantity, 0)::INTEGER, 
        ii.location::TEXT, 
        ii.updated_at::TIMESTAMP WITH TIME ZONE 
    FROM public.inventory_items ii 
    ORDER BY ii.name ASC;
END; $$;

-- 4. RE-IMPLEMENT: upsert_inventory_item_secure
-- Accepts p_id as TEXT. If '0' or empty, creates new (UUID).
CREATE OR REPLACE FUNCTION public.upsert_inventory_item_secure(
    p_caller_id BIGINT, 
    p_id TEXT, 
    p_name TEXT, 
    p_condition TEXT, 
    p_quantity INTEGER, 
    p_location TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Akses Ditolak'; END IF;

    IF p_id = '0' OR p_id IS NULL OR p_id = '' THEN
        INSERT INTO public.inventory_items (name, condition, quantity, total_quantity, location, updated_at) 
        VALUES (p_name, p_condition, p_quantity, p_quantity, p_location, now());
    ELSE
        UPDATE public.inventory_items SET 
            name = p_name, 
            condition = p_condition, 
            quantity = p_quantity, 
            total_quantity = p_quantity, 
            location = p_location, 
            updated_at = now() 
        WHERE id::TEXT = p_id;
    END IF;
END; $$;

-- 5. RE-IMPLEMENT: delete_inventory_item_secure
CREATE OR REPLACE FUNCTION public.delete_inventory_item_secure(
    p_caller_id BIGINT, 
    p_id TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Akses Ditolak'; END IF;
    DELETE FROM public.inventory_items WHERE id::TEXT = p_id;
END; $$;

-- 6. GRANTS
GRANT ALL ON TABLE public.inventory_items TO authenticated, service_role, anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
