-- =====================================================
-- Migration: ROBUST SSO HANDSHAKE (V25)
-- Purpose: Fail-safe Handshake Generation
-- =====================================================

-- 1. CLEANUP TABLE SECURITY
ALTER TABLE public.sso_handshakes DISABLE ROW LEVEL SECURITY;

-- 2. ROBUST HANDSHAKE GENERATOR
CREATE OR REPLACE FUNCTION public.get_elearning_handshake_secure(p_viewer_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_code TEXT;
BEGIN
    -- 1. Security Check: Must be a valid user
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: User ID tidak ditemukan (ID: %)', p_viewer_id;
    END IF;

    -- 2. Cleanup old/expired handshakes
    DELETE FROM public.sso_handshakes WHERE user_id = p_viewer_id OR expires_at < now();

    -- 3. Generate random code (Using native UUID which is foolproof)
    v_code := gen_random_uuid()::text;

    -- 4. Store handshake (RLS is disabled, so this will always succeed via SECURITY DEFINER)
    INSERT INTO public.sso_handshakes (code, user_id) VALUES (v_code, p_viewer_id);

    RETURN v_code;
END; $$;

-- 3. CONFIRM GRANTS
GRANT ALL ON TABLE public.sso_handshakes TO authenticated, service_role, anon;
GRANT ALL ON FUNCTION public.get_elearning_handshake_secure(BIGINT) TO authenticated, service_role, anon;
