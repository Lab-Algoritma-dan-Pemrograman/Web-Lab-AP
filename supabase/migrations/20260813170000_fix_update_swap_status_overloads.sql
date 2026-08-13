-- =========================================================================
-- Migration: Support 3-parameter and 4-parameter overloads for update_swap_status_secure
-- Date: 2026-08-13
-- =========================================================================

-- 1. Create or replace 4-parameter version with DEFAULT NULL
CREATE OR REPLACE FUNCTION public.update_swap_status_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_status TEXT,
    p_substitute_id BIGINT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_orig_name TEXT;
    v_sub_name TEXT;
    v_date DATE;
    v_user_id BIGINT;
BEGIN
    IF NOT (public.is_staff(p_caller_id) OR EXISTS (SELECT 1 FROM public.schedule_assignments sa WHERE sa.id = p_id AND sa.user_id = p_caller_id)) THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    SELECT user_id, activity_date INTO v_user_id, v_date
    FROM public.schedule_assignments WHERE id = p_id;

    SELECT full_name INTO v_orig_name FROM public.users WHERE id = v_user_id;
    IF p_substitute_id IS NOT NULL THEN
        SELECT full_name INTO v_sub_name FROM public.users WHERE id = p_substitute_id;
    END IF;

    UPDATE public.schedule_assignments SET 
        status = p_status, 
        substitute_user_id = p_substitute_id 
    WHERE id = p_id;

    PERFORM public.log_activity(
        p_caller_id, 
        'GUARD_SCHEDULE', 
        'Mengubah status swap jadwal jaga ID ' || p_id::TEXT || ' menjadi "' || p_status || '"' || CASE WHEN p_substitute_id IS NOT NULL THEN ' dengan pengganti ' || COALESCE(v_sub_name, '') ELSE '' END, 
        jsonb_build_object('id', p_id, 'status', p_status, 'substitute_id', p_substitute_id, 'date', v_date)
    );
END; $$;

-- 2. Create 3-parameter overload version for PostgREST backwards compatibility
CREATE OR REPLACE FUNCTION public.update_swap_status_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_status TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public.update_swap_status_secure(p_caller_id, p_id, p_status, NULL::BIGINT);
END; $$;

GRANT EXECUTE ON FUNCTION public.update_swap_status_secure(BIGINT, BIGINT, TEXT, BIGINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_swap_status_secure(BIGINT, BIGINT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
