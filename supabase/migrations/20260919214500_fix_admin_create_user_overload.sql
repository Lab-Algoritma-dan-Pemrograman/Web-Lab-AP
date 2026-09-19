-- =========================================================================
-- Migration: Fix admin_create_user overload ambiguity
-- Masalah: Fungsi public.admin_create_user memiliki 2 overload di database:
--          1) versi lama 12 parameter (BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN)
--          2) versi baru 13 parameter (+ p_major TEXT DEFAULT NULL)
--          Ketika register_users_batch memanggil dengan 12 argumen, Postgres
--          bingung karena kedua signature cocok (ambiguous overload).
-- Solusi : Hapus fungsi versi lama (12 parameter) dan pastikan register_users_batch
--          memanggil fungsi 13 parameter secara bersih.
-- =========================================================================

-- 1. Hapus overload lama 12 parameter
DROP FUNCTION IF EXISTS public.admin_create_user(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

-- 2. Pastikan fungsi admin_create_user (13 parameter) terdaftar dengan benar
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
        RAISE EXCEPTION 'Akses Ditolak: Hanya koordinator yang dapat membuat akun.';
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
REVOKE EXECUTE ON FUNCTION public.admin_create_user(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM anon, authenticated;

-- 3. Perbarui register_users_batch untuk meneruskan p_major
CREATE OR REPLACE FUNCTION public.register_users_batch(
    p_caller_id BIGINT,
    p_users     JSONB
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    user_record JSONB;
    v_role TEXT;
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya koordinator yang dapat melakukan registrasi massal.';
    END IF;

    FOR user_record IN SELECT * FROM jsonb_array_elements(p_users)
    LOOP
        v_role := COALESCE(user_record->>'role', 'praktikan');

        PERFORM public.admin_create_user(
            p_caller_id,
            (user_record->>'username'),
            COALESCE(user_record->>'password', '123456'),
            (user_record->>'full_name'),
            v_role,
            (user_record->>'nim'),
            (user_record->>'assistant_code'),
            (user_record->>'division'),
            (user_record->>'phone_number'),
            (user_record->>'class_code'),
            (user_record->>'shift'),
            COALESCE((user_record->>'is_active')::boolean, true),
            (user_record->>'major')
        );
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_users_batch(BIGINT, JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.register_users_batch(BIGINT, JSONB) FROM anon, authenticated;
