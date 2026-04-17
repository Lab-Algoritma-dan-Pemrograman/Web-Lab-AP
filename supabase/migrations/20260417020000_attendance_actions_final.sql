-- =====================================================
-- Migration: FINAL MASTER REPAIR (V5.1)
-- Resolve: Attendance Logic, Profile, UUID Errors
-- =====================================================

-- 1. UTILITY: Helper to Drop All Overloads (Aggressive)
DO $$ DECLARE
    r record;
BEGIN
    FOR r IN (SELECT proname, oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace 
              AND proname IN (
                  'upsert_attendance_log_secure', 'get_qr_session_secure', 'check_already_absent_secure',
                  'update_user_profile_secure', 'delete_attendance_log_secure'
              ))
    LOOP
        EXECUTE 'DROP FUNCTION public.' || r.proname || '(' || pg_get_function_identity_arguments(r.oid) || ') CASCADE';
    END LOOP;
END $$;

-- 2. ATTENDANCE ACTIONS
CREATE OR REPLACE FUNCTION public.upsert_attendance_log_secure(
    p_caller_id BIGINT, p_target_user_id BIGINT, p_status TEXT, p_notes TEXT, 
    p_check_in TIMESTAMP WITH TIME ZONE, p_is_verified BOOLEAN, p_type TEXT,
    p_session_id TEXT DEFAULT NULL, p_schedule_id TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Permission Check: Staff can upsert anyone, students can only upsert themselves for izin/reschedule
    IF NOT public.is_staff(p_caller_id) AND p_caller_id != p_target_user_id THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    INSERT INTO public.attendance_logs (
        custom_user_id, status, notes, check_in_time, is_verified, 
        verification_status, type, reschedule_schedule_id
    ) VALUES (
        p_target_user_id, p_status, p_notes, p_check_in, p_is_verified,
        CASE WHEN p_is_verified THEN 'verified' ELSE 'pending' END,
        p_type, p_schedule_id::UUID
    );
END; $$;

CREATE OR REPLACE FUNCTION public.delete_attendance_log_secure(
    p_caller_id BIGINT, p_log_id BIGINT, p_reason TEXT, p_target_nim TEXT, p_snapshot_data JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    
    -- Log the deletion first
    INSERT INTO public.attendance_deletion_logs (log_id, target_nim, reason, deleted_by_id, snapshot_data)
    VALUES (p_log_id, p_target_nim, p_reason, p_caller_id, p_snapshot_data);
    
    DELETE FROM public.attendance_logs WHERE id = p_log_id;
END; $$;

-- 3. QR & VALIDATION
CREATE OR REPLACE FUNCTION public.get_qr_session_secure(p_token TEXT)
RETURNS TABLE (id UUID, title TEXT, expires_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT qs.id, qs.title, qs.expires_at FROM public.qr_sessions qs 
    WHERE qs.token = p_token AND qs.expires_at > now();
END; $$;

CREATE OR REPLACE FUNCTION public.check_already_absent_secure(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.attendance_logs 
        WHERE custom_user_id = p_user_id 
        AND check_in_time::DATE = CURRENT_DATE
        AND type = 'scan'
    );
END; $$;

-- 4. PROFILE
CREATE OR REPLACE FUNCTION public.update_user_profile_secure(p_caller_id BIGINT, p_phone_number TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.users SET phone_number = p_phone_number WHERE id = p_caller_id;
END; $$;
