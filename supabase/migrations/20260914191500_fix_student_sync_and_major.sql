-- Migration: Fix student sync to group and major resolution from NIM
-- 1. Helper function to extract major from NIM
CREATE OR REPLACE FUNCTION public.get_major_from_nim(p_nim TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
    IF p_nim IS NULL OR length(p_nim) < 6 THEN
        RETURN NULL;
    END IF;
    RETURN CASE substring(p_nim from 5 for 2)
        WHEN '14' THEN 'S1 Teknik Tenaga Listrik'
        WHEN '15' THEN 'S1 Teknik Sistem Energi'
        WHEN '71' THEN 'D3 Teknologi Listrik'
        WHEN '11' THEN 'S1 Teknik Elektro'
        ELSE NULL
    END;
END; $$;

-- 2. Helper function to normalize major string for comparison
CREATE OR REPLACE FUNCTION public.normalize_major(p_major TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
    IF p_major IS NULL THEN RETURN ''; END IF;
    RETURN lower(trim(regexp_replace(regexp_replace(p_major, '^(S1|D3)\s+', '', 'i'), '\s+', ' ', 'g')));
END; $$;

-- 3. Helper function to check if student's major matches target schedule major
CREATE OR REPLACE FUNCTION public.majors_match(
    p_user_major TEXT,
    p_user_nim TEXT,
    p_user_division TEXT,
    p_target_major TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
    v_norm_target TEXT;
    v_nim_major TEXT;
BEGIN
    IF p_target_major IS NULL OR trim(p_target_major) = '' OR p_target_major = 'Semua Jurusan' THEN
        RETURN TRUE;
    END IF;
    
    v_norm_target := public.normalize_major(p_target_major);
    
    -- Check u.major
    IF p_user_major IS NOT NULL AND public.normalize_major(p_user_major) = v_norm_target THEN
        RETURN TRUE;
    END IF;
    
    -- Check major derived from NIM
    v_nim_major := public.get_major_from_nim(p_user_nim);
    IF v_nim_major IS NOT NULL AND public.normalize_major(v_nim_major) = v_norm_target THEN
        RETURN TRUE;
    END IF;
    
    -- Check u.division (fallback)
    IF p_user_division IS NOT NULL AND public.normalize_major(p_user_division) = v_norm_target THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END; $$;

-- 4. Backfill major column for existing users based on NIM
UPDATE public.users
SET major = public.get_major_from_nim(nim)
WHERE (major IS NULL OR major = '') AND nim IS NOT NULL AND length(nim) >= 6;

-- 5. Fix sync_students_to_group_secure to use majors_match
DROP FUNCTION IF EXISTS public.sync_students_to_group_secure(BIGINT, BIGINT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.sync_students_to_group_secure(
    p_caller_id BIGINT,
    p_schedule_id BIGINT,
    p_major TEXT,
    p_class_code TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sched_title TEXT;
    v_count INT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    
    SELECT title INTO v_sched_title FROM public.schedules WHERE id = p_schedule_id;
    
    INSERT INTO public.group_members (schedule_id, student_id)
    SELECT p_schedule_id, u.id FROM public.users u 
    WHERE u.role = 'praktikan' 
      AND u.class_code = p_class_code
      AND public.majors_match(u.major, u.nim, u.division, p_major)
    ON CONFLICT (schedule_id, student_id) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;

    PERFORM public.log_activity(
        p_caller_id, 
        'PLOT_SCHEDULE', 
        'Melakukan sinkronisasi/plotting ' || v_count::TEXT || ' mahasiswa ke jadwal ' || COALESCE(v_sched_title, 'ID ' || p_schedule_id::TEXT) || ' (' || p_major || ' - ' || p_class_code || ')', 
        jsonb_build_object('schedule_id', p_schedule_id, 'major', p_major, 'class_code', p_class_code, 'synced_count', v_count)
    );
END; $$;

GRANT EXECUTE ON FUNCTION public.sync_students_to_group_secure(BIGINT, BIGINT, TEXT, TEXT) TO authenticated, service_role;

-- 6. Update admin_create_user to auto-populate major from NIM if major is not passed or NULL
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
    p_is_active     BOOLEAN DEFAULT true,
    p_major         TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    v_password_hash TEXT;
    v_computed_major TEXT;
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya koordinator yang dapat membuat akun staf.';
    END IF;

    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username tidak boleh kosong.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.users WHERE username = p_username) THEN
        RAISE EXCEPTION 'Username "%" sudah terdaftar.', p_username;
    END IF;

    v_password_hash := extensions.crypt(COALESCE(p_password, '123456'), extensions.gen_salt('bf'));
    v_computed_major := COALESCE(p_major, public.get_major_from_nim(p_nim), p_division);

    INSERT INTO public.users (
        username, password, full_name, role, nim,
        assistant_code, division, phone_number, class_code, shift, is_active, major
    ) VALUES (
        trim(p_username), v_password_hash, trim(p_full_name), p_role, p_nim,
        p_assistant_code, p_division, p_phone_number, p_class_code, p_shift, p_is_active, v_computed_major
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO service_role;

-- 7. Update register_user to auto-populate major
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
    p_is_active     BOOLEAN DEFAULT true,
    p_major         TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    v_password_hash TEXT;
    v_computed_major TEXT;
BEGIN
    IF p_role NOT IN ('praktikan', 'penyewa') THEN
        RAISE EXCEPTION 'Pendaftaran mandiri hanya diizinkan untuk role praktikan atau penyewa. Role "%" tidak diizinkan.', p_role;
    END IF;

    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username tidak boleh kosong.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.users WHERE username = p_username) THEN
        RAISE EXCEPTION 'Username "%" sudah terdaftar.', p_username;
    END IF;

    IF length(p_password) < 6 THEN
        RAISE EXCEPTION 'Password minimal 6 karakter.';
    END IF;

    v_password_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));
    v_computed_major := COALESCE(p_major, public.get_major_from_nim(p_nim), p_division);

    INSERT INTO public.users (
        username, password, full_name, role, nim,
        assistant_code, division, phone_number, class_code, shift, is_active, major
    ) VALUES (
        trim(p_username), v_password_hash, trim(p_full_name), p_role, p_nim,
        p_assistant_code, p_division, p_phone_number, p_class_code, p_shift, p_is_active, v_computed_major
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO service_role, authenticated, anon;
