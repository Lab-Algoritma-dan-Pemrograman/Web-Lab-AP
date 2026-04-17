-- =====================================================
-- Migration: SSO HANDSHAKE GATEWAY (V24)
-- Purpose: Bridge Custom Login with Secure SSO
-- =====================================================

-- 1. HANDSHAKE STORAGE
CREATE TABLE IF NOT EXISTS public.sso_handshakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '2 minutes')
);

-- Index for fast verification
CREATE INDEX IF NOT EXISTS idx_sso_handshakes_code ON public.sso_handshakes(code);

-- 2. HANDSHAKE GENERATOR RPC
CREATE OR REPLACE FUNCTION public.get_elearning_handshake_secure(p_viewer_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_code TEXT;
BEGIN
    -- 1. Security Check: Must be a valid user
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: User tidak valid';
    END IF;

    -- 2. Cleanup old handshakes for this user
    DELETE FROM public.sso_handshakes WHERE user_id = p_viewer_id OR expires_at < now();

    -- 3. Generate random code
    v_code := encode(gen_random_bytes(16), 'hex');

    -- 4. Store handshake
    INSERT INTO public.sso_handshakes (code, user_id) VALUES (v_code, p_viewer_id);

    RETURN v_code;
END; $$;

-- 3. GRANTS
GRANT ALL ON TABLE public.sso_handshakes TO authenticated, service_role, anon;
GRANT ALL ON FUNCTION public.get_elearning_handshake_secure(BIGINT) TO authenticated, service_role, anon;
