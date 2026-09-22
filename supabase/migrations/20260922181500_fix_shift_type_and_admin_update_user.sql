-- =========================================================================
-- Migration: Fix shift column data type, admin_update_user, and push_subscriptions constraint
-- =========================================================================

-- 1. Pastikan kolom shift di tabel users bertipe TEXT
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

-- 2. Pastikan tabel push_subscriptions memiliki unique constraint pada kolom endpoint
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
    -- Hapus duplikat jika ada sebelum pasang unique constraint
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

-- Enable RLS & Policy
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own subscriptions"
ON public.push_subscriptions FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- 3. Update RPC save_push_subscription_secure
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

-- 4. Update fungsi admin_update_user dengan penanganan shift dan normalisasi role
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

    SELECT full_name, class_code, nim, division 
    INTO v_old_name, v_old_class_code, v_old_nim, v_old_division 
    FROM public.users WHERE id = p_target_id;

    v_normalized_role := CASE WHEN p_role = 'mahasiswa' THEN 'praktikan' ELSE p_role END;
    v_target_major := COALESCE(public.get_major_from_nim(COALESCE(p_nim, v_old_nim)), p_division, v_old_division);
    v_clean_shift := NULLIF(trim(p_shift), '');

    UPDATE public.users SET
        username         = p_username,
        full_name        = p_full_name,
        phone_number     = NULLIF(trim(p_phone_number), ''),
        role             = v_normalized_role,
        is_active        = p_is_active,
        shift            = v_clean_shift,
        nim              = NULLIF(trim(p_nim), ''),
        class_code       = NULLIF(trim(p_class_code), ''),
        division         = NULLIF(trim(p_division), ''),
        assistant_code   = NULLIF(trim(p_assistant_code), ''),
        major            = v_target_major
    WHERE id = p_target_id;

    -- JIKA PRAKTIKAN BERUBAH KELAS / JURUSAN:
    IF v_normalized_role = 'praktikan' AND (
        COALESCE(p_class_code, '') IS DISTINCT FROM COALESCE(v_old_class_code, '')
    ) THEN
        -- 1. Hapus plotting lama dari jadwal kelas yang sudah tidak sesuai
        DELETE FROM public.group_members gm
        USING public.schedules s
        WHERE gm.schedule_id = s.id
          AND gm.student_id = p_target_id
          AND (
            COALESCE(s.class_code, '') != COALESCE(p_class_code, '')
            OR NOT public.majors_match(v_target_major, COALESCE(p_nim, v_old_nim), p_division, s.major)
          );

        -- 2. Otomatis hubungkan ke jadwal praktikum kelas barunya jika jadwal tersedia
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
NOTIFY pgrst, 'reload schema';
