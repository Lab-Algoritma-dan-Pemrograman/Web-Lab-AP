-- =====================================================
-- Migration: RESCHEDULE LOGIC RESTORATION (V14)
-- Resolve: "Hadir 101" Bug (Stop Duplicate Inserts)
-- Resolve: "Validasi Kosong" Bug (Fix Aggressive Filtering)
-- Resolve: "Approve then Scan" Requirement (Logic Separation)
-- =====================================================

-- 1. NEW RPC: Specialized Reschedule Request
-- This UPDATES the existing log instead of creating a new one.
DROP FUNCTION IF EXISTS public.request_reschedule_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.request_reschedule_secure(
    p_log_id BIGINT,
    p_new_schedule_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.attendance_logs SET
        reschedule_schedule_id = p_new_schedule_id,
        reschedule_status = 'pending'
    WHERE id = p_log_id;
END; $$;

-- 2. UPDATE: Admin Verification Logic (Refined)
-- Approval now ONLY clears the student for replacement, does NOT set 'Hadir'.
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
            is_verified = p_is_approved
        WHERE id = p_log_id;
    ELSIF p_type = 'reschedule' THEN
        UPDATE public.attendance_logs SET
            reschedule_status = CASE WHEN p_is_approved THEN 'approved' ELSE 'rejected' END,
            -- Important: We do NOT set status = 'Hadir' here.
            -- Approval only grants the "lampu hijau" for the replacement day.
            reschedule_schedule_id = CASE WHEN p_is_approved THEN reschedule_schedule_id ELSE NULL END
        WHERE id = p_log_id;
    END IF;
END; $$;

-- 3. ENSURE GRANTS
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
