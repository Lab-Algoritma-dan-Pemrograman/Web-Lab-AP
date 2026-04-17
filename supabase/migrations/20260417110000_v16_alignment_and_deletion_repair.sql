-- =====================================================
-- Migration: ALIGNMENT & DELETION REPAIR (V16)
-- Resolve: Deletion Error (Align with attendance_deletion_history)
-- Resolve: Hadir 101 Bug (Reinforce No-Insert Logic)
-- =====================================================

-- 1. ALIGN DELETE RPC: Use attendance_deletion_history
-- Matching your DDL: deleted_by (BIGINT), target_user_id (TEXT), snapshot_data (JSONB)
CREATE OR REPLACE FUNCTION public.delete_attendance_log_secure(
    p_caller_id BIGINT, 
    p_log_id BIGINT, 
    p_reason TEXT, 
    p_target_nim TEXT, 
    p_snapshot_data JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Akses Ditolak'; END IF;
    
    -- Log the deletion into the ACTUAL table name and columns
    INSERT INTO public.attendance_deletion_history (deleted_by, target_user_id, reason, snapshot_data)
    VALUES (p_caller_id, p_target_nim, p_reason, p_snapshot_data);
    
    DELETE FROM public.attendance_logs WHERE id = p_log_id;
END; $$;

-- 2. ALIGN HISTORY VIEW: Use attendance_deletion_history
CREATE OR REPLACE FUNCTION public.get_deletion_history_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id UUID, 
    deleted_at TIMESTAMP WITH TIME ZONE,
    target_user_id TEXT, 
    reason TEXT, 
    deleted_by_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT h.id, h.deleted_at, h.target_user_id, h.reason, u.full_name
    FROM public.attendance_deletion_history h
    LEFT JOIN public.users u ON h.deleted_by = u.id
    ORDER BY h.deleted_at DESC;
END; $$;

-- 3. REINFORCE RESCHEDULE: request_reschedule_secure
CREATE OR REPLACE FUNCTION public.request_reschedule_secure(
    p_log_id BIGINT,
    p_new_schedule_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- DO NOT INSERT. ONLY UPDATE.
    -- This definitively kills the "Hadir 101" bug.
    UPDATE public.attendance_logs SET
        reschedule_schedule_id = p_new_schedule_id,
        reschedule_status = 'pending'
    WHERE id = p_log_id;
END; $$;

-- 4. ENSURE GRANTS
GRANT ALL ON TABLE public.attendance_deletion_history TO authenticated, service_role, anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
