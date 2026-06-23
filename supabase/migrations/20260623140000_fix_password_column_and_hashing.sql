-- Migration to fix user registration and password updates by targeting the correct "password" column
-- and qualifying hashing functions to avoid search path resolution issues.

-- 1. Ensure pgcrypto extension exists in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Redefine register_user
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    v_password_hash TEXT;
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

    INSERT INTO public.users (
        username, password, full_name, role, nim,
        assistant_code, division, phone_number, class_code, shift, is_active
    ) VALUES (
        trim(p_username), v_password_hash, trim(p_full_name), p_role, p_nim,
        p_assistant_code, p_division, p_phone_number, p_class_code, p_shift, p_is_active
    );
END;
$$;

-- 3. Redefine admin_create_user
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    v_password_hash TEXT;
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

    INSERT INTO public.users (
        username, password, full_name, role, nim,
        assistant_code, division, phone_number, class_code, shift, is_active
    ) VALUES (
        trim(p_username), v_password_hash, trim(p_full_name), p_role, p_nim,
        p_assistant_code, p_division, p_phone_number, p_class_code, p_shift, p_is_active
    );
END;
$$;

-- 4. Redefine update_password
CREATE OR REPLACE FUNCTION public.update_password(
    p_caller_id BIGINT,
    p_target_id BIGINT,
    p_new_password TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
    IF p_caller_id != p_target_id AND NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya koordinator yang dapat mengubah password orang lain.';
    END IF;

    IF length(p_new_password) < 3 THEN
        RAISE EXCEPTION 'Password minimal 3 karakter.';
    END IF;

    UPDATE public.users
    SET password = extensions.crypt(p_new_password, extensions.gen_salt('bf'))
    WHERE id = p_target_id;
END;
$$;

-- 5. Restore Permissions & Grants
GRANT EXECUTE ON FUNCTION public.register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
REVOKE EXECUTE ON FUNCTION public.admin_create_user(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_password(BIGINT, BIGINT, TEXT) TO service_role, authenticated, anon;
