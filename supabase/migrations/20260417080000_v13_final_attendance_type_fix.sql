-- =====================================================
-- Migration: SURGICAL ATTENDANCE TYPE FIX (V13)
-- Resolve: UUID casting error in Rescheduling
-- =====================================================

-- 1. DROP old signatures to ensure no conflict
DROP FUNCTION IF EXISTS public.upsert_attendance_log_secure(BIGINT, BIGINT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, BOOLEAN, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.upsert_attendance_log_secure(BIGINT, BIGINT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, BOOLEAN, TEXT, TEXT, BIGINT);

-- 2. RE-IMPLEMENT with BIGINT for p_schedule_id
CREATE OR REPLACE FUNCTION public.upsert_attendance_log_secure(
    p_caller_id BIGINT, 
    p_target_user_id BIGINT, 
    p_status TEXT, 
    p_notes TEXT, 
    p_check_in TIMESTAMP WITH TIME ZONE, 
    p_is_verified BOOLEAN, 
    p_type TEXT,
    p_session_id TEXT DEFAULT NULL, 
    p_schedule_id BIGINT DEFAULT NULL -- FIXED: Use BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Permission Check: Staff can upsert anyone, students can only upsert themselves for izin/reschedule
    IF NOT public.is_staff(p_caller_id) AND p_caller_id != p_target_user_id THEN
        RAISE EXCEPTION 'Akses Ditolak';
    END IF;

    INSERT INTO public.attendance_logs (
        custom_user_id, status, notes, check_in_time, is_verified, 
        verification_status, type, reschedule_schedule_id
    ) VALUES (
        p_target_user_id, p_status, p_notes, p_check_in, p_is_verified,
        CASE WHEN p_is_verified THEN 'approved' ELSE 'pending' END,
        p_type, p_schedule_id -- FIXED: No UUID cast
    );
END; $$;

-- 3. ENSURE GRANTS
GRANT ALL ON FUNCTION public.upsert_attendance_log_secure TO authenticated, service_role, anon;
