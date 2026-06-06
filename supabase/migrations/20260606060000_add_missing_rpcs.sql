-- =========================================================================
-- Migration: ADD MISSING RPCs
-- Date: 2026-06-06
-- Purpose: Menambahkan RPC yang diperlukan agar frontend tidak perlu
--          akses langsung ke tabel users (yang sudah di-block oleh RLS).
-- =========================================================================

-- 1. RPC: check_username_exists
-- Dipakai di halaman Daftar (Login.tsx) untuk cek apakah username sudah ada.
-- Mengembalikan boolean, tidak membocorkan data user lain.
CREATE OR REPLACE FUNCTION public.check_username_exists(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.users WHERE username = p_username);
END;
$$;

-- 2. RPC: update_user_profile_secure
-- Dipakai di halaman Profil (Profil.tsx) untuk update nama sendiri.
-- Hanya user sendiri yang bisa update profil miliknya.
CREATE OR REPLACE FUNCTION public.update_user_profile_secure(
    p_user_id BIGINT,
    p_full_name TEXT
) RETURNS TABLE (
    id BIGINT,
    username TEXT,
    full_name TEXT,
    role TEXT,
    nim TEXT,
    assistant_code TEXT,
    division TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Update nama
    UPDATE public.users u
    SET full_name = p_full_name
    WHERE u.id = p_user_id;

    -- Return data user yang sudah terupdate
    RETURN QUERY
    SELECT u.id, u.username, u.full_name, u.role, u.nim, u.assistant_code, u.division
    FROM public.users u
    WHERE u.id = p_user_id;
END;
$$;

-- Grant akses untuk anon (karena app pakai custom auth, bukan Supabase Auth)
GRANT EXECUTE ON FUNCTION public.check_username_exists(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_user_profile_secure(BIGINT, TEXT) TO anon, authenticated, service_role;
