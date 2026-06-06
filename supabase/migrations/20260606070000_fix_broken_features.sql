-- =========================================================================
-- Migration: FIX BROKEN FEATURES (RLS Hardening Workarounds)
-- Date: 2026-06-06
-- Purpose: Menambahkan RPC agar frontend tidak memanggil tabel schedule_assignments
--          dan class_rosters secara langsung (karena sudah dikunci oleh RLS).
-- =========================================================================

-- 1. RPC: check_pj_absen_today
-- Memeriksa apakah asisten bersangkutan memiliki peran 'PJ Absen' yang aktif hari ini.
CREATE OR REPLACE FUNCTION public.check_pj_absen_today(p_user_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_exists BOOLEAN;
    v_today DATE;
BEGIN
    -- Menentukan tanggal hari ini berdasarkan zona waktu Asia/Jakarta (WIB)
    v_today := (timezone('Asia/Jakarta', now()))::date;
    
    SELECT EXISTS (
        SELECT 1 
        FROM public.schedule_assignments 
        WHERE user_id = p_user_id 
          AND task_role = 'PJ Absen' 
          AND activity_date = v_today 
          AND status = 'aktif'
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$;

-- 2. RPC: sync_class_rosters_secure
-- Melakukan sinkronisasi roster kelas agregat secara aman dari data jadwal.
CREATE OR REPLACE FUNCTION public.sync_class_rosters_secure(
    p_caller_id BIGINT,
    p_payload JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_item JSONB;
BEGIN
    -- Validasi sederhana: pastikan caller_id adalah user terdaftar
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Invalid caller id';
    END IF;

    -- Iterasi isi array payload JSON dan lakukan upsert aman (ignore duplicate)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload)
    LOOP
        INSERT INTO public.class_rosters (schedule_id, assistant_id, student_id)
        VALUES (
            (v_item->>'schedule_id')::UUID,
            (v_item->>'assistant_id')::BIGINT,
            (v_item->>'student_id')::BIGINT
        )
        ON CONFLICT (schedule_id, student_id) DO NOTHING;
    END LOOP;
END;
$$;

-- Berikan izin akses eksekusi ke anon dan authenticated
GRANT EXECUTE ON FUNCTION public.check_pj_absen_today(BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_class_rosters_secure(BIGINT, JSONB) TO anon, authenticated, service_role;
