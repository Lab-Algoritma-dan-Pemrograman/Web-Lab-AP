-- =====================================================
-- Migration: RENTAL SYSTEM INTEGRATION (V34)
-- Purpose: Support Public Renters (Penyewa Umum) 
-- Workflow: Request -> Approve -> Active -> Returned
-- =====================================================

-- 1. PATCH INVENTORY ITEMS
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS "is_rentable" BOOLEAN DEFAULT false;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS "price_per_day" NUMERIC DEFAULT 0;

-- 2. CREATE RENTALS TABLE
CREATE TABLE IF NOT EXISTS public.inventory_rentals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(id),
    item_id BIGINT REFERENCES public.inventory_items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sewa', 'pinjam')),
    total_price NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'returned', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. ENABLE RLS
ALTER TABLE public.inventory_rentals ENABLE ROW LEVEL SECURITY;

-- 4. RPC: get_inventory_items_secure (Updated to include rental info)
DROP FUNCTION IF EXISTS public.get_inventory_items_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_inventory_items_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    condition TEXT,
    quantity INTEGER,
    price_per_day NUMERIC,
    is_rentable BOOLEAN,
    location TEXT,
    last_checked TIMESTAMP WITH TIME ZONE
)  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT 
        ii.id::BIGINT, 
        ii.name::TEXT, 
        ii.condition::TEXT, 
        ii.quantity::INTEGER, 
        ii.price_per_day::NUMERIC,
        ii.is_rentable::BOOLEAN,
        ii.location::TEXT,
        ii.last_checked::TIMESTAMP WITH TIME ZONE
    FROM public.inventory_items ii 
    ORDER BY ii.name ASC;
END; $$;

-- 5. RPC: upsert_inventory_item_secure (Updated)
DROP FUNCTION IF EXISTS public.upsert_inventory_item_secure(BIGINT, TEXT, TEXT, TEXT, INTEGER, TEXT, BOOLEAN, NUMERIC);
CREATE OR REPLACE FUNCTION public.upsert_inventory_item_secure(
    p_caller_id BIGINT, 
    p_id TEXT, 
    p_name TEXT, 
    p_condition TEXT, 
    p_quantity INTEGER, 
    p_location TEXT,
    p_is_rentable BOOLEAN DEFAULT false,
    p_price_per_day NUMERIC DEFAULT 0
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Akses Ditolak'; END IF;
    IF p_id = '0' OR p_id IS NULL OR p_id = '' THEN
        INSERT INTO public.inventory_items (name, condition, quantity, location, is_rentable, price_per_day, last_checked) 
        VALUES (p_name, p_condition, p_quantity, p_location, p_is_rentable, p_price_per_day, now());
    ELSE
        UPDATE public.inventory_items SET 
            name = p_name, 
            condition = p_condition, 
            quantity = p_quantity, 
            location = p_location, 
            is_rentable = p_is_rentable,
            price_per_day = p_price_per_day,
            last_checked = now() 
        WHERE id::TEXT = p_id;
    END IF;
END; $$;

-- 5b. RPC: get_renter_items_secure (For Renter Catalog)
DROP FUNCTION IF EXISTS public.get_renter_items_secure();
CREATE OR REPLACE FUNCTION public.get_renter_items_secure()
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    condition TEXT,
    quantity INTEGER,
    price_per_day NUMERIC,
    location TEXT
)  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT 
        ii.id::BIGINT, 
        ii.name::TEXT, 
        ii.condition::TEXT, 
        ii.quantity::INTEGER, 
        ii.price_per_day::NUMERIC,
        ii.location::TEXT
    FROM public.inventory_items ii 
    WHERE ii.is_rentable = true AND ii.quantity > 0
    ORDER BY ii.name ASC;
END; $$;

-- 5c. RPC: submit_rental_request_secure
DROP FUNCTION IF EXISTS public.submit_rental_request_secure(BIGINT, BIGINT, INTEGER, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.submit_rental_request_secure(
    p_user_id BIGINT,
    p_item_id BIGINT,
    p_quantity INTEGER,
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_type TEXT,
    p_notes TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_item_price NUMERIC;
    v_rental_days INTEGER;
    v_calculated_total NUMERIC;
BEGIN
    -- AMBIL HARGA PER HARI (Gunakan subquery untuk menghindari ambiguitas SELECT INTO)
    v_item_price := (SELECT price_per_day FROM public.inventory_items WHERE id::TEXT = p_item_id::TEXT LIMIT 1);
    
    -- HITUNG JUMLAH HARI
    v_rental_days := EXTRACT(DAY FROM (p_end_date - p_start_date))::INTEGER;
    IF v_rental_days <= 0 THEN v_rental_days := 1; END IF;
    
    -- HITUNG TOTAL BIAYA
    IF p_type = 'sewa' THEN
        v_calculated_total := COALESCE(v_item_price, 0) * v_rental_days * p_quantity;
    ELSE
        v_calculated_total := 0;
    END IF;

    -- SIMPAN KE TABEL
    INSERT INTO public.inventory_rentals (
        user_id, item_id, quantity, start_date, end_date, type, total_price, status, notes
    ) VALUES (
        p_user_id, p_item_id, p_quantity, p_start_date, p_end_date, p_type, COALESCE(v_calculated_total, 0), 'pending', p_notes
    );
END; $$;

-- 6. RPC: get_my_rentals_secure
DROP FUNCTION IF EXISTS public.get_my_rentals_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_my_rentals_secure(p_user_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    item_name TEXT,
    quantity INTEGER,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    type TEXT,
    total_price NUMERIC,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT 
        ir.id::BIGINT,
        ii.name::TEXT,
        ir.quantity::INTEGER,
        ir.start_date::TIMESTAMP WITH TIME ZONE,
        ir.end_date::TIMESTAMP WITH TIME ZONE,
        ir.type::TEXT,
        ir.total_price::NUMERIC,
        ir.status::TEXT,
        ir.notes::TEXT,
        ir.created_at::TIMESTAMP WITH TIME ZONE
    FROM public.inventory_rentals ir
    JOIN public.inventory_items ii ON ir.item_id = ii.id
    WHERE ir.user_id = p_user_id
    ORDER BY ir.created_at DESC;
END; $$;

-- 7. RPC: get_admin_rentals_secure
DROP FUNCTION IF EXISTS public.get_admin_rentals_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_admin_rentals_secure(p_caller_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    renter_name TEXT,
    renter_phone TEXT,
    item_name TEXT,
    item_id BIGINT,
    quantity INTEGER,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    type TEXT,
    total_price NUMERIC,
    status TEXT,
    notes TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Akses Ditolak'; END IF;

    RETURN QUERY SELECT 
        ir.id::BIGINT,
        u.full_name::TEXT,
        u.phone_number::TEXT,
        ii.name::TEXT,
        ii.id::BIGINT,
        ir.quantity::INTEGER,
        ir.start_date::TIMESTAMP WITH TIME ZONE,
        ir.end_date::TIMESTAMP WITH TIME ZONE,
        ir.type::TEXT,
        ir.total_price::NUMERIC,
        ir.status::TEXT,
        ir.notes::TEXT
    FROM public.inventory_rentals ir
    JOIN public.users u ON ir.user_id = u.id
    JOIN public.inventory_items ii ON ir.item_id = ii.id
    ORDER BY CASE 
        WHEN ir.status = 'pending' THEN 1
        WHEN ir.status = 'approved' THEN 2
        WHEN ir.status = 'active' THEN 3
        ELSE 4 
    END, ir.created_at DESC;
END; $$;

-- 8. RPC: update_rental_status_secure
DROP FUNCTION IF EXISTS public.update_rental_status_secure(BIGINT, BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.update_rental_status_secure(
    p_caller_id BIGINT,
    p_rental_id BIGINT,
    p_new_status TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_item_id BIGINT;
    v_qty INTEGER;
    v_old_status TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Akses Ditolak'; END IF;

    -- AMBIL DATA SEWA (Gunakan baris tunggal untuk menghindari ambiguitas penugasan)
    SELECT item_id, quantity, status 
    INTO v_item_id, v_qty, v_old_status 
    FROM public.inventory_rentals 
    WHERE id::TEXT = p_rental_id::TEXT;

    -- Handle Inventory Stock changes
    -- 1. Marking as ACTIVE (Taken) -> Reduce stock
    IF p_new_status = 'active' AND COALESCE(v_old_status, '') != 'active' THEN
        UPDATE public.inventory_items SET quantity = quantity - COALESCE(v_qty, 0) WHERE id::TEXT = v_item_id::TEXT;
    END IF;

    -- 2. Marking as RETURNED (Back) -> Restore stock
    IF p_new_status = 'returned' AND COALESCE(v_old_status, '') = 'active' THEN
        UPDATE public.inventory_items SET quantity = quantity + COALESCE(v_qty, 0) WHERE id::TEXT = v_item_id::TEXT;
    END IF;

    -- 3. Marking as REJECTED from previously being ACTIVE (Edge case) -> Restore stock
    IF p_new_status = 'rejected' AND COALESCE(v_old_status, '') = 'active' THEN
        UPDATE public.inventory_items SET quantity = quantity + COALESCE(v_qty, 0) WHERE id::TEXT = v_item_id::TEXT;
    END IF;

    UPDATE public.inventory_rentals SET status = p_new_status, updated_at = now() WHERE id::TEXT = p_rental_id::TEXT;
END; $$;

-- 9. GRANTS
GRANT ALL ON TABLE public.inventory_rentals TO authenticated, service_role, anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
