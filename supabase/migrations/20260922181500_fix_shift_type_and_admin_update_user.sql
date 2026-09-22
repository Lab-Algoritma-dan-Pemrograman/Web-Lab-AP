-- =========================================================================
-- MASTER MIGRATION: 100% EXACT DATABASE SCHEMA ALIGNMENT
-- Tailored to: users (password_hash, nama, divisi, kode_asisten, shift TEXT), siakad_audit_logs, push_subscriptions
-- Functions: login_user, get_user_profile, get_users_secure, admin_update_user, save_push_subscription_secure, log_activity
-- =========================================================================

-- 1. Pastikan kolom shift di tabel users bertipe TEXT & lepas constraint yang membatasi input dinamis
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'shift' 
          AND data_type != 'text'
    ) THEN
        ALTER TABLE public.users ALTER COLUMN shift TYPE TEXT USING shift::TEXT;
    END IF;
END $$;

-- Lepas FK dan Unique constraint pada divisi & kode_asisten agar fleksibel
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_divisi_fkey;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_kode_asisten_fkey;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS uq_users_kode_asisten;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_kode_asisten_key;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_assistant_code_key;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS uq_users_assistant_code;
DROP INDEX IF EXISTS public.uq_users_kode_asisten;
DROP INDEX IF EXISTS public.users_kode_asisten_key;
DROP INDEX IF EXISTS public.users_assistant_code_key;

-- 2. Pastikan tabel push_subscriptions & siakad_audit_logs
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ 
BEGIN
    DELETE FROM public.push_subscriptions a
    USING public.push_subscriptions b
    WHERE a.id < b.id AND a.endpoint = b.endpoint;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'push_subscriptions_endpoint_key'
    ) THEN
        ALTER TABLE public.push_subscriptions 
        ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
    END IF;
END $$;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own subscriptions"
ON public.push_subscriptions FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.siakad_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    actor_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    actor_name TEXT,
    action_type TEXT NOT NULL,
    description TEXT,
    payload JSONB
);

ALTER TABLE public.siakad_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "siakad_audit_logs_access" ON public.siakad_audit_logs;
CREATE POLICY "siakad_audit_logs_access"
ON public.siakad_audit_logs FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- 3. CORE HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_staff(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role IN ('koordinator', 'asisten', 'sekretaris', 'k3'));
END; $$;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role IN ('koordinator', 'sekretaris'));
END; $$;

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

CREATE OR REPLACE FUNCTION public.normalize_major(p_major TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
    IF p_major IS NULL THEN RETURN ''; END IF;
    RETURN lower(trim(regexp_replace(regexp_replace(p_major, '^(S1|D3)\s+', '', 'i'), '\s+', ' ', 'g')));
END; $$;

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
    IF p_user_major IS NOT NULL AND public.normalize_major(p_user_major) = v_norm_target THEN
        RETURN TRUE;
    END IF;
    v_nim_major := public.get_major_from_nim(p_user_nim);
    IF v_nim_major IS NOT NULL AND public.normalize_major(v_nim_major) = v_norm_target THEN
        RETURN TRUE;
    END IF;
    IF p_user_division IS NOT NULL AND public.normalize_major(p_user_division) = v_norm_target THEN
        RETURN TRUE;
    END IF;
    RETURN FALSE;
END; $$;

CREATE OR REPLACE FUNCTION public.log_activity(
    p_actor_id BIGINT,
    p_action_type TEXT,
    p_description TEXT,
    p_payload JSONB DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_name TEXT;
BEGIN
    SELECT COALESCE(full_name, nama) INTO v_name FROM public.users WHERE id = p_actor_id;
    INSERT INTO public.siakad_audit_logs (actor_id, actor_name, action_type, description, payload)
    VALUES (p_actor_id, COALESCE(v_name, 'System/Unknown'), p_action_type, p_description, p_payload);
END; $$;

-- 4. DROP semua fungsi lama yang konflik dengan signature baru
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT proname, oid 
        FROM pg_proc 
        WHERE pronamespace = 'public'::regnamespace 
          AND proname IN ('login_user', 'get_user_profile', 'get_users_secure', 'admin_update_user', 'save_push_subscription_secure')
    ) LOOP
        EXECUTE 'DROP FUNCTION public.' || quote_ident(r.proname) || '(' || pg_get_function_identity_arguments(r.oid) || ') CASCADE';
    END LOOP;
END $$;

-- 5. RECREATE: login_user (Mendukung kolom password_hash, username/nim, full_name/nama)
CREATE OR REPLACE FUNCTION public.login_user(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    id BIGINT,
    username TEXT,
    full_name TEXT,
    role TEXT,
    password TEXT,
    is_active BOOLEAN,
    shift TEXT,
    division TEXT,
    nim TEXT,
    assistant_code TEXT,
    class_code TEXT,
    phone_number TEXT,
    major TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        u.id::BIGINT,
        COALESCE(u.username, u.nim, u.id::TEXT)::TEXT,
        COALESCE(u.full_name, u.nama, '')::TEXT,
        u.role::TEXT,
        COALESCE(u.password_hash, u.fb_password_hash, '')::TEXT AS password,
        COALESCE(u.is_active, u.is_aktif, true)::BOOLEAN,
        u.shift::TEXT,
        COALESCE(u.division, u.divisi, '')::TEXT,
        u.nim::TEXT,
        COALESCE(u.assistant_code, u.kode_asisten, '')::TEXT,
        COALESCE(u.class_code, u.kelas, '')::TEXT,
        COALESCE(u.phone_number, u.nomor_hp, '')::TEXT,
        COALESCE(u.major, u.jurusan, '')::TEXT
    FROM public.users u
    WHERE lower(COALESCE(u.username, '')) = lower(trim(p_username))
       OR lower(COALESCE(u.nim, '')) = lower(trim(p_username))
       OR lower(COALESCE(u.email, '')) = lower(trim(p_username))
    LIMIT 1;
END; $$;

GRANT EXECUTE ON FUNCTION public.login_user(TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. RECREATE: get_user_profile
CREATE OR REPLACE FUNCTION public.get_user_profile(
    p_caller_id BIGINT,
    p_target_id BIGINT
) RETURNS TABLE (
    id BIGINT,
    username TEXT,
    full_name TEXT,
    role TEXT,
    nim TEXT,
    assistant_code TEXT,
    division TEXT,
    is_active BOOLEAN,
    phone_number TEXT,
    shift TEXT,
    class_code TEXT,
    major TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_caller_id != p_target_id AND NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Tidak dapat melihat profil pengguna lain.';
    END IF;

    RETURN QUERY
    SELECT 
        u.id::BIGINT,
        COALESCE(u.username, u.nim, u.id::TEXT)::TEXT,
        COALESCE(u.full_name, u.nama, '')::TEXT,
        u.role::TEXT,
        u.nim::TEXT,
        COALESCE(u.assistant_code, u.kode_asisten, '')::TEXT,
        COALESCE(u.division, u.divisi, '')::TEXT,
        COALESCE(u.is_active, u.is_aktif, true)::BOOLEAN,
        COALESCE(u.phone_number, u.nomor_hp, '')::TEXT,
        u.shift::TEXT,
        COALESCE(u.class_code, u.kelas, '')::TEXT,
        COALESCE(u.major, u.jurusan, '')::TEXT
    FROM public.users u
    WHERE u.id = p_target_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_user_profile(BIGINT, BIGINT) TO service_role, anon, authenticated;

-- 7. RECREATE: get_users_secure
CREATE OR REPLACE FUNCTION public.get_users_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT, 
    username TEXT, 
    full_name TEXT, 
    phone_number TEXT, 
    role TEXT,
    nim TEXT, 
    assistant_code TEXT, 
    division TEXT, 
    class_code TEXT,
    shift TEXT, 
    is_active BOOLEAN, 
    created_at TIMESTAMP WITH TIME ZONE,
    major TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT
        u.id::BIGINT,
        COALESCE(u.username, u.nim, u.id::TEXT)::TEXT,
        COALESCE(u.full_name, u.nama, '')::TEXT,
        COALESCE(u.phone_number, u.nomor_hp, '')::TEXT,
        u.role::TEXT,
        u.nim::TEXT,
        COALESCE(u.assistant_code, u.kode_asisten, '')::TEXT,
        COALESCE(u.division, u.divisi, '')::TEXT,
        COALESCE(u.class_code, u.kelas, '')::TEXT,
        u.shift::TEXT,
        COALESCE(u.is_active, u.is_aktif, true)::BOOLEAN,
        COALESCE(u.created_at, now())::TIMESTAMP WITH TIME ZONE,
        COALESCE(u.major, u.jurusan, '')::TEXT
    FROM public.users u 
    ORDER BY u.role ASC, COALESCE(u.full_name, u.nama) ASC;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_users_secure(BIGINT) TO anon, authenticated, service_role;

-- 8. RECREATE: save_push_subscription_secure
CREATE OR REPLACE FUNCTION public.save_push_subscription_secure(
    p_caller_id BIGINT,
    p_endpoint TEXT,
    p_p256dh TEXT,
    p_auth TEXT,
    p_user_agent TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_caller_id IS NULL OR p_caller_id = 0 THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
    VALUES (p_caller_id, p_endpoint, p_p256dh, p_auth, p_user_agent, now())
    ON CONFLICT (endpoint) 
    DO UPDATE SET 
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        updated_at = now();
END; $$;

GRANT EXECUTE ON FUNCTION public.save_push_subscription_secure TO authenticated, service_role, anon;

-- 9. RECREATE: admin_update_user
CREATE OR REPLACE FUNCTION public.admin_update_user(
    p_caller_id     BIGINT,
    p_target_id     BIGINT,
    p_username      TEXT,
    p_full_name     TEXT,
    p_phone_number  TEXT,
    p_role          TEXT,
    p_is_active     BOOLEAN,
    p_shift         TEXT,
    p_nim           TEXT,
    p_class_code    TEXT,
    p_division      TEXT,
    p_assistant_code TEXT
) 
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, extensions 
AS $$
DECLARE
    v_old_name TEXT;
    v_old_class_code TEXT;
    v_old_nim TEXT;
    v_old_division TEXT;
    v_target_major TEXT;
    v_normalized_role TEXT;
    v_clean_shift TEXT;
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only Koordinator can perform this action';
    END IF;

    SELECT 
        COALESCE(full_name, nama), 
        COALESCE(class_code, kelas), 
        nim, 
        COALESCE(division, divisi) 
    INTO v_old_name, v_old_class_code, v_old_nim, v_old_division 
    FROM public.users WHERE id = p_target_id;

    v_normalized_role := CASE WHEN p_role = 'mahasiswa' THEN 'praktikan' ELSE p_role END;
    v_target_major := COALESCE(public.get_major_from_nim(COALESCE(p_nim, v_old_nim)), p_division, v_old_division);
    v_clean_shift := NULLIF(trim(p_shift), '');

    UPDATE public.users SET
        username         = p_username,
        full_name        = p_full_name,
        nama             = p_full_name,
        phone_number     = NULLIF(trim(p_phone_number), ''),
        nomor_hp         = NULLIF(trim(p_phone_number), ''),
        role             = v_normalized_role,
        is_active        = p_is_active,
        is_aktif         = p_is_active,
        shift            = v_clean_shift,
        nim              = COALESCE(NULLIF(trim(p_nim), ''), v_old_nim, CASE WHEN p_username ~ '^[0-9]+$' THEN p_username ELSE NULL END),
        class_code       = NULLIF(trim(p_class_code), ''),
        kelas            = NULLIF(trim(p_class_code), ''),
        division         = NULLIF(trim(p_division), ''),
        divisi           = NULLIF(trim(p_division), ''),
        assistant_code   = NULLIF(trim(p_assistant_code), ''),
        kode_asisten     = NULLIF(trim(p_assistant_code), ''),
        major            = v_target_major,
        jurusan          = v_target_major
    WHERE id = p_target_id;

    -- JIKA PRAKTIKAN BERUBAH KELAS / JURUSAN:
    IF v_normalized_role = 'praktikan' AND (
        COALESCE(p_class_code, '') IS DISTINCT FROM COALESCE(v_old_class_code, '')
    ) THEN
        DELETE FROM public.group_members gm
        USING public.schedules s
        WHERE gm.schedule_id = s.id
          AND gm.student_id = p_target_id
          AND (
            COALESCE(s.class_code, '') != COALESCE(p_class_code, '')
            OR NOT public.majors_match(v_target_major, COALESCE(p_nim, v_old_nim), p_division, s.major)
          );

        IF p_class_code IS NOT NULL AND trim(p_class_code) != '' THEN
            INSERT INTO public.group_members (schedule_id, student_id)
            SELECT s.id, p_target_id
            FROM public.schedules s
            WHERE s.type = 'praktikum'
              AND s.status = 'approved'
              AND s.class_code = p_class_code
              AND public.majors_match(v_target_major, COALESCE(p_nim, v_old_nim), p_division, s.major)
            ON CONFLICT (schedule_id, student_id) DO NOTHING;
        END IF;
    END IF;

    PERFORM public.log_activity(
        p_caller_id, 
        'USER_MANAGEMENT', 
        'Mengubah data user ' || COALESCE(v_old_name, 'ID ' || p_target_id::TEXT) || ' menjadi nama: "' || p_full_name || '", username: "' || p_username || '", role: "' || v_normalized_role || '"' || 
        CASE WHEN COALESCE(p_class_code, '') IS DISTINCT FROM COALESCE(v_old_class_code, '') 
             THEN ' (pindah kelas dari ' || COALESCE(v_old_class_code, '-') || ' ke ' || COALESCE(p_class_code, '-') || ')' 
             ELSE '' END, 
        jsonb_build_object(
            'target_id', p_target_id, 
            'username', p_username, 
            'full_name', p_full_name, 
            'role', v_normalized_role, 
            'is_active', p_is_active,
            'old_class_code', v_old_class_code,
            'new_class_code', p_class_code,
            'division', p_division,
            'assistant_code', p_assistant_code
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user(BIGINT, BIGINT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 10. Reload PostgREST Cache
NOTIFY pgrst, 'reload schema';
