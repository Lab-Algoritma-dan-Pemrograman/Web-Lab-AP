-- Migration: Remove ambiguous TEXT overload for delete_attendance_log_secure and keep canonical JSONB version
DROP FUNCTION IF EXISTS public.delete_attendance_log_secure(BIGINT, BIGINT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_attendance_log_secure(BIGINT, BIGINT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.delete_attendance_log_secure(
    p_caller_id BIGINT, 
    p_log_id BIGINT, 
    p_reason TEXT, 
    p_target_nim TEXT, 
    p_snapshot_data JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.has_delete_attendance_access(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses Ditolak: Hanya ketua divisi/koordinator/asisten sekre & K3 yang dapat menghapus absensi.'; 
    END IF;
    
    INSERT INTO public.attendance_deletion_history (deleted_by, target_user_id, reason, snapshot_data)
    VALUES (p_caller_id, p_target_nim, p_reason, p_snapshot_data);
    
    DELETE FROM public.attendance_logs WHERE id = p_log_id;

    PERFORM public.log_activity(
        p_caller_id, 
        'DELETE_ATTENDANCE', 
        'Menghapus absensi NIM ' || p_target_nim || '. Alasan: ' || p_reason, 
        jsonb_build_object('log_id', p_log_id, 'snapshot', p_snapshot_data)
    );
END; $$;

GRANT EXECUTE ON FUNCTION public.delete_attendance_log_secure(BIGINT, BIGINT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
