-- =========================================================================
-- Migration: FIX SYSTEM SETTINGS UPDATE (UPDATE requires a WHERE clause)
-- Date: 2026-06-08
-- Purpose: Menghapus overloading fungsi admin_update_system_setting yang lama
--          dan membuat ulang fungsi dengan WHERE clause yang dijamin aman
--          serta penanganan record kosong (fallback insert).
-- =========================================================================

-- 1. Hapus fungsi lama untuk menghindari konflik overloading tipe data (INTEGER vs BIGINT)
DROP FUNCTION IF EXISTS public.admin_update_system_setting(INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_system_setting(BIGINT, TEXT);

-- 2. Buat kembali fungsi dengan WHERE clause yang aman
CREATE OR REPLACE FUNCTION public.admin_update_system_setting(
    p_caller_id BIGINT,
    p_active_shift TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id BIGINT;
BEGIN
    -- Validasi hak akses staf (koordinator / asisten)
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staf yang diperbolehkan.';
    END IF;

    -- Ambil ID dari record pengaturan yang ada
    SELECT id INTO v_id FROM public.system_settings LIMIT 1;

    IF v_id IS NOT NULL THEN
        -- Lakukan update terarah menggunakan WHERE clause
        UPDATE public.system_settings 
        SET active_shift = p_active_shift, 
            updated_at = now()
        WHERE id = v_id;
    ELSE
        -- Jika tabel kosong (belum ada record sama sekali), lakukan insert
        INSERT INTO public.system_settings (active_shift, updated_at) 
        VALUES (p_active_shift, now());
    END IF;
END;
$$;

-- 3. Berikan izin akses eksekusi
GRANT EXECUTE ON FUNCTION public.admin_update_system_setting(BIGINT, TEXT) TO anon, authenticated, service_role;
