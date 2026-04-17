-- =====================================================
-- Migration: FIX USER MANAGEMENT RPC (V29)
-- Purpose: Resolve function signature mismatch and align with BIGINT
-- Resolve: "Could not find function public.admin_update_user"
-- =====================================================

-- 1. DROP ALL POSSIBLE OVERLOADS to clean up schema cache
DO $$ 
DECLARE
    r record;
BEGIN
    FOR r IN (SELECT proname, oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'admin_update_user')
    LOOP
        EXECUTE 'DROP FUNCTION public.admin_update_user(' || pg_get_function_identity_arguments(r.oid) || ') CASCADE';
    END LOOP;
END $$;

-- 2. RECREATE admin_update_user (12 Parameters - V12 BIGINT Standard)
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
SET search_path = public 
AS $$
BEGIN
    -- SECURITY CHECK
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only Koordinator can perform this action';
    END IF;

    UPDATE public.users SET
        username         = p_username,
        full_name        = p_full_name,
        phone_number     = p_phone_number,
        role             = p_role,
        is_active        = p_is_active,
        shift            = p_shift,
        nim              = p_nim,
        class_code       = p_class_code,
        division         = p_division,
        assistant_code   = p_assistant_code
    WHERE id = p_target_id;
END; $$;

-- 3. GRANTS
GRANT ALL ON FUNCTION public.admin_update_user(BIGINT, BIGINT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role, anon;
