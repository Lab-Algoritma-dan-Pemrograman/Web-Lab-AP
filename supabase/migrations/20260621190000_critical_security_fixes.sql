-- =====================================================
-- Migration: CRITICAL SECURITY HARDENING (20260621190000)
-- Purpose: Revoke public execution of all functions, grant selectively to public,
--          fix default function privileges, and repair log_activity bug in admin_toggle_user_status.
-- =====================================================

-- 1. REVOKE DEFAULT EXECUTION RIGHTS ON ALL FUNCTIONS IN SCHEMA public
-- By default, PostgreSQL grants EXECUTE to PUBLIC on all functions.
-- We revoke this to prevent direct RPC invocation via PostgREST (anon/authenticated).
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, public;

-- 2. GRANT ALL EXECUTE RIGHTS TO service_role
-- Vercel API proxy handles all operations with service_role privileges.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 3. SELECTIVELY GRANT EXECUTE TO anon AND authenticated ON PUBLIC RPCs
-- These RPCs are marked as PUBLIC_RPCS in Vercel API proxy and can be executed publicly.
-- Note: Since they go through Vercel proxy, service_role is used, but we keep these database-level
-- grants as fallback and security documentation.

-- 3.1 check_username_exists(TEXT)
GRANT EXECUTE ON FUNCTION public.check_username_exists(TEXT) TO anon, authenticated;

-- 3.2 login_user
-- Since its definition signature might vary slightly (e.g. VARCHAR vs TEXT), we grant to the function name.
-- If login_user has no overloads, this syntax is supported in PostgreSQL 10+.
GRANT EXECUTE ON FUNCTION public.login_user TO anon, authenticated;

-- 3.3 register_user
GRANT EXECUTE ON FUNCTION public.register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- 3.4 get_public_settings
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;

-- 3.5 get_qr_session_secure
GRANT EXECUTE ON FUNCTION public.get_qr_session_secure(TEXT) TO anon, authenticated;

-- 3.6 get_renter_items_secure
GRANT EXECUTE ON FUNCTION public.get_renter_items_secure() TO anon, authenticated;


-- 4. ALTER DEFAULT PRIVILEGES FOR NEW FUNCTIONS
-- Ensures that future functions created in the public schema do not automatically grant EXECUTE to public/anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;


-- 5. RE-DEFINE admin_toggle_user_status TO FIX LOG_ACTIVITY PARAMETER BUG
-- The previous definition used 3 parameters instead of 4, causing wrong audit logs mapping.
CREATE OR REPLACE FUNCTION public.admin_toggle_user_status(
    p_caller_id BIGINT,
    p_target_id BIGINT,
    p_is_active BOOLEAN
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_name TEXT;
    v_status_text TEXT;
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    SELECT full_name INTO v_name FROM public.users WHERE id = p_target_id;
    v_status_text := CASE WHEN p_is_active THEN 'Mengaktifkan' ELSE 'Menonaktifkan' END;

    UPDATE public.users SET is_active = p_is_active WHERE id = p_target_id;

    -- Correctly pass 4 parameters: actor_id, action_type, description, payload
    PERFORM public.log_activity(
        p_caller_id, 
        'USER_MANAGEMENT',
        v_status_text || ' status aktif user ' || COALESCE(v_name, 'ID ' || p_target_id::TEXT), 
        jsonb_build_object('target_id', p_target_id, 'is_active', p_is_active)
    );
END; $$;

-- Make sure service_role can run it
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_status(BIGINT, BIGINT, BOOLEAN) TO service_role;
