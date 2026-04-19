-- =====================================================
-- Migration: FIX QR SESSION TYPES (V33)
-- Resolve: "invalid input syntax for type bigint" due to UUID vs BIGINT mismatch
-- =====================================================

-- 1. Redefine upsert_qr_session_secure
-- Previous version returned TABLE(id BIGINT), which conflicted with qr_sessions table using UUID
DROP FUNCTION IF EXISTS public.upsert_qr_session_secure(BIGINT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_qr_session_secure(
    p_caller_id BIGINT,
    p_title TEXT,
    p_token TEXT
) RETURNS TABLE (id UUID) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_new_id UUID;
BEGIN
    -- Security Check
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat membuat sesi QR.';
    END IF;

    -- Insert into sessions
    INSERT INTO public.qr_sessions (title, token, created_by, is_active)
    VALUES (p_title, p_token, p_caller_id, TRUE)
    RETURNING public.qr_sessions.id INTO v_new_id;
    
    RETURN QUERY SELECT v_new_id;
END;
$$;

-- 2. Redefine update_qr_session_token_secure
-- Change p_id from BIGINT to UUID to match table schema
DROP FUNCTION IF EXISTS public.update_qr_session_token_secure(BIGINT, BIGINT, TEXT);

CREATE OR REPLACE FUNCTION public.update_qr_session_token_secure(
    p_caller_id BIGINT,
    p_id UUID,
    p_token TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;
    
    UPDATE public.qr_sessions 
    SET token = p_token 
    WHERE id = p_id;
END;
$$;

-- 3. Redefine stop_qr_session_secure
-- Change p_id from BIGINT to UUID to match table schema
DROP FUNCTION IF EXISTS public.stop_qr_session_secure(BIGINT, BIGINT);

CREATE OR REPLACE FUNCTION public.stop_qr_session_secure(
    p_caller_id BIGINT,
    p_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;
    
    UPDATE public.qr_sessions 
    SET is_active = FALSE 
    WHERE id = p_id;
END;
$$;

-- 4. Redefine get_qr_session_secure
-- Use is_active = true as the source of truth instead of expires_at
DROP FUNCTION IF EXISTS public.get_qr_session_secure(TEXT);

CREATE OR REPLACE FUNCTION public.get_qr_session_secure(
    p_token TEXT
) RETURNS TABLE (id UUID, title TEXT, is_active BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY 
    SELECT qs.id, qs.title, qs.is_active
    FROM public.qr_sessions qs
    WHERE qs.token = p_token AND qs.is_active = true
    LIMIT 1;
END;
$$;


-- Grant permissions to keep RPCs accessible
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
