-- Migration: Expose kolom 'major' dari tabel users di get_users_secure RPC
-- Kolom major sudah ada di tabel users tapi belum di-return oleh RPC ini

DROP FUNCTION IF EXISTS public.get_users_secure(BIGINT);

CREATE OR REPLACE FUNCTION public.get_users_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT, username TEXT, full_name TEXT, phone_number TEXT, role TEXT,
    nim TEXT, assistant_code TEXT, division TEXT, class_code TEXT,
    shift TEXT, is_active BOOLEAN, created_at TIMESTAMP WITH TIME ZONE,
    major TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT
        u.id::BIGINT,
        u.username::TEXT,
        u.full_name::TEXT,
        u.phone_number::TEXT,
        u.role::TEXT,
        u.nim::TEXT,
        u.assistant_code::TEXT,
        u.division::TEXT,
        u.class_code::TEXT,
        u.shift::TEXT,
        u.is_active::BOOLEAN,
        u.created_at::TIMESTAMP WITH TIME ZONE,
        u.major::TEXT
    FROM public.users u ORDER BY u.role ASC, u.full_name ASC;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_users_secure(BIGINT) TO anon, authenticated, service_role;
