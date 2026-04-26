-- =====================================================
-- Migration: ATTENDANCE LOG RECORDED BY & AUTO LOGOUT SYNC
-- Resolve: Track who recorded/updated attendance
-- =====================================================

-- 1. SCHEMA UPDATE
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS recorded_by BIGINT REFERENCES public.users(id);

-- 2. UPDATE UPSERT RPC
CREATE OR REPLACE FUNCTION public.upsert_attendance_log_secure(
    p_caller_id BIGINT, 
    p_target_user_id BIGINT, 
    p_status TEXT, 
    p_notes TEXT, 
    p_check_in TIMESTAMP WITH TIME ZONE, 
    p_is_verified BOOLEAN, 
    p_type TEXT,
    p_session_id TEXT DEFAULT NULL, 
    p_schedule_id BIGINT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Permission Check: Staff can upsert anyone, students can only upsert themselves for izin/reschedule
    IF NOT public.is_staff(p_caller_id) AND p_caller_id != p_target_user_id THEN
        RAISE EXCEPTION 'Akses Ditolak';
    END IF;

    -- Note: We use p_caller_id as recorded_by
    INSERT INTO public.attendance_logs (
        custom_user_id, status, notes, check_in_time, is_verified, 
        verification_status, type, reschedule_schedule_id, recorded_by
    ) VALUES (
        p_target_user_id, p_status, p_notes, p_check_in, p_is_verified,
        CASE WHEN p_is_verified THEN 'approved' ELSE 'pending' END,
        p_type, p_schedule_id, p_caller_id
    );
END; $$;

-- 3. UPDATE VERIFY RPC
CREATE OR REPLACE FUNCTION public.admin_verify_attendance_secure(
    p_caller_id BIGINT,
    p_log_id BIGINT,
    p_is_approved BOOLEAN,
    p_type TEXT -- 'license' or 'reschedule'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak';
    END IF;

    IF p_type = 'license' THEN
        UPDATE public.attendance_logs SET
            verification_status = CASE WHEN p_is_approved THEN 'approved' ELSE 'rejected' END,
            is_verified = p_is_approved,
            recorded_by = p_caller_id -- Track who verified
        WHERE id = p_log_id;
    ELSIF p_type = 'reschedule' THEN
        UPDATE public.attendance_logs SET
            reschedule_status = CASE WHEN p_is_approved THEN 'approved' ELSE 'rejected' END,
            reschedule_schedule_id = CASE WHEN p_is_approved THEN reschedule_schedule_id ELSE NULL END,
            recorded_by = p_caller_id -- Track who verified
        WHERE id = p_log_id;
    END IF;
END; $$;

-- 4. UPDATE GET LOGS RPC (Return recorded_by name)
DROP FUNCTION IF EXISTS public.get_attendance_logs_secure(BIGINT);
DROP FUNCTION IF EXISTS public.get_attendance_logs_secure(BIGINT, DATE);
CREATE OR REPLACE FUNCTION public.get_attendance_logs_secure(p_viewer_id BIGINT, p_date_filter DATE DEFAULT NULL)
RETURNS TABLE (
    id BIGINT, status TEXT, notes TEXT, check_in_time TIMESTAMP WITH TIME ZONE, is_verified BOOLEAN, 
    verification_status TEXT, reschedule_status TEXT, reschedule_schedule_id TEXT, 
    user_id BIGINT, user_full_name TEXT, user_role TEXT, user_username TEXT, 
    user_major TEXT, user_class_code TEXT, user_shift TEXT, user_phone_number TEXT, 
    schedule_title TEXT, schedule_day TEXT, schedule_time TIME, type TEXT,
    recorded_by_name TEXT -- NEW COLUMN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time::TIMESTAMP WITH TIME ZONE, 
        al.is_verified::BOOLEAN, al.verification_status::TEXT, al.reschedule_status::TEXT, 
        al.reschedule_schedule_id::TEXT, u.id::BIGINT, u.full_name::TEXT, u.role::TEXT, 
        u.username::TEXT, u.division::TEXT, u.class_code::TEXT, u.shift::TEXT, 
        u.phone_number::TEXT, s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME, al.type::TEXT,
        rb.full_name::TEXT as recorded_by_name
    FROM public.attendance_logs al 
    JOIN public.users u ON al.custom_user_id = u.id 
    LEFT JOIN public.schedules s ON al.reschedule_schedule_id::TEXT = s.id::TEXT
    LEFT JOIN public.users rb ON al.recorded_by = rb.id -- JOIN for recorded_by name
    WHERE (public.is_staff(p_viewer_id) OR al.custom_user_id = p_viewer_id) 
    AND (p_date_filter IS NULL OR al.check_in_time::DATE = p_date_filter)
    ORDER BY al.check_in_time DESC;
END; $$;
