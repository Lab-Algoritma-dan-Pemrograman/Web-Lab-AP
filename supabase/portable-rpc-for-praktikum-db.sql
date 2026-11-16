-- Fungsi yang dibutuhkan siakad, dibuat di DB oidwvfcxlxfyojkyurmm.
-- Sumber: siakad/supabase/migrations (definisi asli), disesuaikan ke kolom
-- yang benar-benar ada di tabel users DB praktikum.

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

-- Tabel penunjang revokasi token (kalau belum ada).
CREATE TABLE IF NOT EXISTS public.revoked_tokens (
    jti TEXT PRIMARY KEY,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);
ALTER TABLE public.revoked_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_token_revoked(p_jti TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.revoked_tokens WHERE jti = p_jti);
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_token(p_jti TEXT, p_expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.revoked_tokens (jti, expires_at)
    VALUES (p_jti, p_expires_at)
    ON CONFLICT (jti) DO NOTHING;
    RETURN TRUE;
END; $$;

GRANT EXECUTE ON FUNCTION public.is_token_revoked(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_token(TEXT, TIMESTAMPTZ) TO anon, authenticated, service_role;
