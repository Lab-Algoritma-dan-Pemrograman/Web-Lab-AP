-- =====================================================
-- Migration: REMOVE MD5 FALLBACK & FIX RESCHEDULE ACCESS (20260621183000)
-- Purpose: Remove MD5 password hashing fallback and validate request_reschedule ownership
-- =====================================================

-- 1. Redefine register_user without MD5 fallback
CREATE OR REPLACE FUNCTION public.register_user(
    p_username      TEXT,
    p_password      TEXT,
    p_full_name     TEXT,
    p_role          TEXT DEFAULT 'praktikan',
    p_nim           TEXT DEFAULT NULL,
    p_assistant_code TEXT DEFAULT NULL,
    p_division      TEXT DEFAULT NULL,
    p_phone_number  TEXT DEFAULT NULL,
    p_class_code    TEXT DEFAULT NULL,
    p_shift         TEXT DEFAULT NULL,
    p_is_active     BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_password_hash TEXT;
BEGIN
    -- Pendaftaran mandiri hanya diizinkan untuk role praktikan dan penyewa.
    IF p_role NOT IN ('praktikan', 'penyewa') THEN
        RAISE EXCEPTION 'Pendaftaran mandiri hanya diizinkan untuk role praktikan atau penyewa. Role "%" tidak diizinkan.', p_role;
    END IF;

    -- Validasi username tidak kosong
    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username tidak boleh kosong.';
    END IF;

    -- Cek duplikat username
    IF EXISTS (SELECT 1 FROM public.users WHERE username = p_username) THEN
        RAISE EXCEPTION 'Username "%" sudah terdaftar.', p_username;
    END IF;

    -- Validasi panjang password
    IF length(p_password) < 6 THEN
        RAISE EXCEPTION 'Password minimal 6 karakter.';
    END IF;



    v_password_hash := crypt(p_password, gen_salt('bf'));

    -- Insert user baru
    INSERT INTO public.users (
        username, password_hash, full_name, role, nim,
        assistant_code, division, phone_number, class_code, shift, is_active
    ) VALUES (
        trim(p_username), v_password_hash, trim(p_full_name), p_role, p_nim,
        p_assistant_code, p_division, p_phone_number, p_class_code, p_shift, p_is_active
    );
END;
$$;

-- 2. Redefine admin_create_user without MD5 fallback
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_caller_id     BIGINT,
    p_username      TEXT,
    p_password      TEXT,
    p_full_name     TEXT,
    p_role          TEXT,
    p_nim           TEXT DEFAULT NULL,
    p_assistant_code TEXT DEFAULT NULL,
    p_division      TEXT DEFAULT NULL,
    p_phone_number  TEXT DEFAULT NULL,
    p_class_code    TEXT DEFAULT NULL,
    p_shift         TEXT DEFAULT NULL,
    p_is_active     BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_password_hash TEXT;
BEGIN
    -- Hanya koordinator yang bisa membuat akun dengan role apapun
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya koordinator yang dapat membuat akun staf.';
    END IF;

    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username tidak boleh kosong.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.users WHERE username = p_username) THEN
        RAISE EXCEPTION 'Username "%" sudah terdaftar.', p_username;
    END IF;



    v_password_hash := crypt(COALESCE(p_password, '123456'), gen_salt('bf'));

    INSERT INTO public.users (
        username, password_hash, full_name, role, nim,
        assistant_code, division, phone_number, class_code, shift, is_active
    ) VALUES (
        trim(p_username), v_password_hash, trim(p_full_name), p_role, p_nim,
        p_assistant_code, p_division, p_phone_number, p_class_code, p_shift, p_is_active
    );
END;
$$;

-- 3. Redefine update_password without MD5 fallback
CREATE OR REPLACE FUNCTION public.update_password(
    p_caller_id BIGINT,   -- Siapa yang memanggil (di-inject dari JWT)
    p_target_id BIGINT,   -- Target user yang akan diubah passwordnya  
    p_new_password TEXT   -- Password baru (plain text, akan di-hash di sini)
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Self-update selalu diizinkan
    -- Update orang lain: hanya koordinator (admin)
    IF p_caller_id != p_target_id AND NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya koordinator yang dapat mengubah password orang lain.';
    END IF;

    -- Validasi panjang password
    IF length(p_new_password) < 3 THEN
        RAISE EXCEPTION 'Password minimal 3 karakter.';
    END IF;



    -- Update password (hash menggunakan crypt jika pgcrypto tersedia)
    UPDATE public.users
    SET password_hash = crypt(p_new_password, gen_salt('bf'))
    WHERE id = p_target_id;
END;
$$;

-- 4. Redefine request_reschedule_secure to accept p_caller_id and prevent BOLA spoofing
DROP FUNCTION IF EXISTS public.request_reschedule_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.request_reschedule_secure(
    p_caller_id BIGINT,
    p_log_id BIGINT,
    p_new_schedule_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- ponytail: BOLA check - only owner or staff can request reschedule
    IF NOT public.is_staff(p_caller_id) AND NOT EXISTS (
        SELECT 1 FROM public.attendance_logs WHERE id = p_log_id AND custom_user_id = p_caller_id
    ) THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak dapat melakukan reschedule untuk log absensi orang lain.';
    END IF;

    UPDATE public.attendance_logs SET
        reschedule_schedule_id = p_new_schedule_id,
        reschedule_status = 'pending'
    WHERE id = p_log_id;
END; $$;

-- 5. Restore Grants
GRANT EXECUTE ON FUNCTION public.register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
REVOKE EXECUTE ON FUNCTION public.admin_create_user(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_password(BIGINT, BIGINT, TEXT) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.request_reschedule_secure(BIGINT, BIGINT, BIGINT) TO service_role, authenticated, anon;
