-- =====================================================
-- Migration: AUDIT LOGGING & DELETION RESTRICTION (20260621151000)
-- Purpose: Restrict attendance deletion/logs to assistant code ending in 'K' and implement automatic database-level Audit Logging
-- =====================================================

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    actor_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    actor_name TEXT,
    action_type TEXT NOT NULL,
    description TEXT,
    payload JSONB
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Revoke all direct client access on audit_logs
REVOKE ALL ON TABLE public.audit_logs FROM anon;
REVOKE ALL ON TABLE public.audit_logs FROM authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;

-- 2. Helper function to log activities securely
CREATE OR REPLACE FUNCTION public.log_activity(
    p_actor_id BIGINT,
    p_action_type TEXT,
    p_description TEXT,
    p_payload JSONB DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_name TEXT;
BEGIN
    SELECT full_name INTO v_name FROM public.users WHERE id = p_actor_id;
    INSERT INTO public.audit_logs (actor_id, actor_name, action_type, description, payload)
    VALUES (p_actor_id, COALESCE(v_name, 'System/Unknown'), p_action_type, p_description, p_payload);
END; $$;

-- 3. Helper function to check delete attendance privileges
CREATE OR REPLACE FUNCTION public.has_delete_attendance_access(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role TEXT;
    v_code TEXT;
    v_active BOOLEAN;
BEGIN
    SELECT role, assistant_code, is_active INTO v_role, v_code, v_active
    FROM public.users WHERE id = p_user_id;
    
    IF v_active IS NOT TRUE THEN
        RETURN FALSE;
    END IF;
    
    IF v_role IN ('koordinator', 'sekretaris', 'k3') THEN
        RETURN TRUE;
    ELSIF v_role = 'asisten' THEN
        IF v_code IS NOT NULL AND UPPER(v_code) LIKE '%K' THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END; $$;

-- 4. Recreate/Update secure functions with audit logging & access checks

-- 4.1. delete_attendance_log_secure
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
        RAISE EXCEPTION 'Akses Ditolak: Hanya ketua divisi/koordinator yang dapat menghapus absensi.'; 
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

-- 4.2. get_deletion_history_secure
DROP FUNCTION IF EXISTS public.get_deletion_history_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_deletion_history_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id UUID, 
    deleted_at TIMESTAMP WITH TIME ZONE,
    target_user_id TEXT, 
    reason TEXT, 
    deleted_by_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.has_delete_attendance_access(p_viewer_id) THEN 
        RAISE EXCEPTION 'Akses Ditolak: Hanya ketua divisi/koordinator yang dapat melihat riwayat hapus.'; 
    END IF;
    RETURN QUERY SELECT h.id, h.deleted_at, h.target_user_id, h.reason, u.full_name
    FROM public.attendance_deletion_history h
    LEFT JOIN public.users u ON h.deleted_by = u.id
    ORDER BY h.deleted_at DESC;
END; $$;

-- 4.3. delete_schedule_secure
DROP FUNCTION IF EXISTS public.delete_schedule_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.delete_schedule_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_title TEXT;
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya koordinator yang dapat menghapus jadwal.';
    END IF;
    
    SELECT title INTO v_title FROM public.schedules WHERE id = p_id;
    
    DELETE FROM public.schedules WHERE id = p_id;

    PERFORM public.log_activity(
        p_caller_id, 
        'DELETE_SCHEDULE', 
        'Menghapus jadwal: ' || COALESCE(v_title, 'ID ' || p_id::TEXT), 
        jsonb_build_object('schedule_id', p_id, 'title', v_title)
    );
END; $$;

-- 4.4. sync_students_to_group_secure
DROP FUNCTION IF EXISTS public.sync_students_to_group_secure(BIGINT, BIGINT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.sync_students_to_group_secure(p_caller_id BIGINT, p_schedule_id BIGINT, p_major TEXT, p_class_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sched_title TEXT;
    v_count INT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    
    SELECT title INTO v_sched_title FROM public.schedules WHERE id = p_schedule_id;
    
    INSERT INTO public.group_members (schedule_id, student_id)
    SELECT p_schedule_id, u.id FROM public.users u 
    WHERE u.role = 'praktikan' AND u.division = p_major AND u.class_code = p_class_code
    ON CONFLICT (schedule_id, student_id) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;

    PERFORM public.log_activity(
        p_caller_id, 
        'PLOT_SCHEDULE', 
        'Melakukan sinkronisasi/plotting ' || v_count::TEXT || ' mahasiswa ke jadwal ' || COALESCE(v_sched_title, 'ID ' || p_schedule_id::TEXT) || ' (' || p_major || ' - ' || p_class_code || ')', 
        jsonb_build_object('schedule_id', p_schedule_id, 'major', p_major, 'class_code', p_class_code, 'synced_count', v_count)
    );
END; $$;

-- 4.5. reset_group_plotting_secure
DROP FUNCTION IF EXISTS public.reset_group_plotting_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.reset_group_plotting_secure(p_caller_id BIGINT, p_schedule_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sched_title TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    
    SELECT title INTO v_sched_title FROM public.schedules WHERE id = p_schedule_id;
    
    UPDATE public.group_members SET assistant_id = NULL WHERE schedule_id = p_schedule_id;

    PERFORM public.log_activity(
        p_caller_id, 
        'PLOT_SCHEDULE', 
        'Mereset asisten plotting pada jadwal ' || COALESCE(v_sched_title, 'ID ' || p_schedule_id::TEXT), 
        jsonb_build_object('schedule_id', p_schedule_id, 'title', v_sched_title)
    );
END; $$;

-- 4.6. upsert_group_assistant_secure
DROP FUNCTION IF EXISTS public.upsert_group_assistant_secure(BIGINT, BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.upsert_group_assistant_secure(
    p_caller_id BIGINT, 
    p_schedule_id BIGINT, 
    p_assistant_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sched_title TEXT;
    v_asst_name TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF;
    
    SELECT title INTO v_sched_title FROM public.schedules WHERE id = p_schedule_id;
    SELECT full_name INTO v_asst_name FROM public.users WHERE id = p_assistant_id;
    
    INSERT INTO public.group_assistants (schedule_id, assistant_id) 
    VALUES (p_schedule_id, p_assistant_id) 
    ON CONFLICT (schedule_id, assistant_id) DO NOTHING;

    PERFORM public.log_activity(
        p_caller_id, 
        'PLOT_SCHEDULE', 
        'Menambahkan asisten ' || COALESCE(v_asst_name, 'ID ' || p_assistant_id::TEXT) || ' ke jadwal ' || COALESCE(v_sched_title, 'ID ' || p_schedule_id::TEXT), 
        jsonb_build_object('schedule_id', p_schedule_id, 'assistant_id', p_assistant_id)
    );
END; $$;

-- 4.7. delete_group_assistant_secure
DROP FUNCTION IF EXISTS public.delete_group_assistant_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.delete_group_assistant_secure(
    p_caller_id BIGINT, 
    p_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sched_title TEXT;
    v_asst_name TEXT;
    v_sched_id BIGINT;
    v_asst_id BIGINT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF;
    
    SELECT schedule_id, assistant_id INTO v_sched_id, v_asst_id 
    FROM public.group_assistants WHERE id = p_id;
    
    SELECT title INTO v_sched_title FROM public.schedules WHERE id = v_sched_id;
    SELECT full_name INTO v_asst_name FROM public.users WHERE id = v_asst_id;
    
    DELETE FROM public.group_assistants WHERE id = p_id;

    PERFORM public.log_activity(
        p_caller_id, 
        'PLOT_SCHEDULE', 
        'Menghapus asisten ' || COALESCE(v_asst_name, 'ID ' || v_asst_id::TEXT) || ' dari jadwal ' || COALESCE(v_sched_title, 'ID ' || v_sched_id::TEXT), 
        jsonb_build_object('group_assistant_id', p_id, 'schedule_id', v_sched_id, 'assistant_id', v_asst_id)
    );
END; $$;

-- 4.8. upsert_financial_record_secure
DROP FUNCTION IF EXISTS public.upsert_financial_record_secure(BIGINT, BIGINT, TEXT, NUMERIC, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.upsert_financial_record_secure(
    p_caller_id BIGINT, 
    p_id BIGINT, 
    p_title TEXT, 
    p_amount NUMERIC, 
    p_type TEXT, 
    p_category TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    IF p_id = 0 OR p_id IS NULL THEN
        INSERT INTO public.financial_records (title, amount, type, category, date, created_at) 
        VALUES (p_title, p_amount, p_type, p_category, CURRENT_DATE, now());
        
        PERFORM public.log_activity(
            p_caller_id, 
            'FINANCE_CHANGE', 
            'Membuat laporan keuangan baru: "' || p_title || '" (' || p_type || ', Jumlah: ' || p_amount::TEXT || ')', 
            jsonb_build_object('title', p_title, 'amount', p_amount, 'type', p_type, 'category', p_category)
        );
    ELSE
        UPDATE public.financial_records SET title = p_title, amount = p_amount, type = p_type, category = p_category WHERE id = p_id;
        
        PERFORM public.log_activity(
            p_caller_id, 
            'FINANCE_CHANGE', 
            'Mengubah laporan keuangan ID ' || p_id::TEXT || ': "' || p_title || '" (' || p_type || ', Jumlah: ' || p_amount::TEXT || ')', 
            jsonb_build_object('id', p_id, 'title', p_title, 'amount', p_amount, 'type', p_type, 'category', p_category)
        );
    END IF;
END; $$;

-- 4.9. delete_financial_record_secure
DROP FUNCTION IF EXISTS public.delete_financial_record_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.delete_financial_record_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_title TEXT;
    v_amount NUMERIC;
    v_type TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    
    SELECT title, amount, type INTO v_title, v_amount, v_type 
    FROM public.financial_records WHERE id = p_id;
    
    DELETE FROM public.financial_records WHERE id = p_id;

    PERFORM public.log_activity(
        p_caller_id, 
        'FINANCE_CHANGE', 
        'Menghapus laporan keuangan: "' || COALESCE(v_title, 'ID ' || p_id::TEXT) || '" (' || COALESCE(v_type, '') || ', Jumlah: ' || COALESCE(v_amount::TEXT, '0') || ')', 
        jsonb_build_object('id', p_id, 'title', v_title, 'amount', v_amount, 'type', v_type)
    );
END; $$;

-- 4.10. admin_update_user
DROP FUNCTION IF EXISTS public.admin_update_user(BIGINT, BIGINT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT);
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
DECLARE
    v_old_name TEXT;
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only Koordinator can perform this action';
    END IF;

    SELECT full_name INTO v_old_name FROM public.users WHERE id = p_target_id;

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

    PERFORM public.log_activity(
        p_caller_id, 
        'USER_MANAGEMENT', 
        'Mengubah data user ' || COALESCE(v_old_name, 'ID ' || p_target_id::TEXT) || ' menjadi nama: "' || p_full_name || '", username: "' || p_username || '", role: "' || p_role || '"', 
        jsonb_build_object(
            'target_id', p_target_id, 
            'username', p_username, 
            'full_name', p_full_name, 
            'role', p_role, 
            'is_active', p_is_active,
            'division', p_division,
            'assistant_code', p_assistant_code
        )
    );
END; $$;

-- 4.11. admin_delete_user
DROP FUNCTION IF EXISTS public.admin_delete_user(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.admin_delete_user(
    p_caller_id BIGINT,
    p_target_id BIGINT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_name TEXT;
    v_username TEXT;
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT full_name, username INTO v_name, v_username FROM public.users WHERE id = p_target_id;

    DELETE FROM public.attendance_logs     WHERE custom_user_id = p_target_id;
    DELETE FROM public.feedback            WHERE custom_user_id = p_target_id;
    DELETE FROM public.group_members       WHERE student_id = p_target_id OR assistant_id = p_target_id;
    DELETE FROM public.group_assistants    WHERE assistant_id = p_target_id;
    DELETE FROM public.schedule_assignments WHERE user_id = p_target_id;
    DELETE FROM public.assistant_availability WHERE user_id = p_target_id;
    DELETE FROM public.elearning_progress  WHERE nim = v_username;
    DELETE FROM public.users WHERE id = p_target_id;

    PERFORM public.log_activity(
        p_caller_id, 
        'USER_MANAGEMENT', 
        'Menghapus permanen user ' || COALESCE(v_name, 'ID ' || p_target_id::TEXT) || ' (NIM/Username: ' || COALESCE(v_username, '-') || ')', 
        jsonb_build_object('target_id', p_target_id, 'full_name', v_name, 'username', v_username)
    );
END; $$;

-- 4.12. admin_toggle_user_status
DROP FUNCTION IF EXISTS public.admin_toggle_user_status(BIGINT, BIGINT, BOOLEAN);
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

    PERFORM public.log_activity(
        p_caller_id, 
        v_status_text || ' status aktif user ' || COALESCE(v_name, 'ID ' || p_target_id::TEXT), 
        jsonb_build_object('target_id', p_target_id, 'is_active', p_is_active)
    );
END; $$;

-- 4.13. upsert_qr_session_secure
DROP FUNCTION IF EXISTS public.upsert_qr_session_secure(BIGINT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.upsert_qr_session_secure(
    p_caller_id BIGINT,
    p_title TEXT,
    p_token TEXT
) RETURNS TABLE (id UUID) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_new_id UUID;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat membuat sesi QR.';
    END IF;

    INSERT INTO public.qr_sessions (title, token, created_by, is_active)
    VALUES (p_title, p_token, p_caller_id, TRUE)
    RETURNING public.qr_sessions.id INTO v_new_id;
    
    PERFORM public.log_activity(
        p_caller_id, 
        'CREATE_QR', 
        'Membuat sesi QR Absensi baru: "' || p_title || '"', 
        jsonb_build_object('qr_id', v_new_id, 'title', p_title, 'token', p_token)
    );

    RETURN QUERY SELECT v_new_id;
END; $$;

-- 4.14. admin_verify_attendance_secure
DROP FUNCTION IF EXISTS public.admin_verify_attendance_secure(BIGINT, BIGINT, BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION public.admin_verify_attendance_secure(
    p_caller_id BIGINT,
    p_log_id BIGINT,
    p_is_approved BOOLEAN,
    p_type TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_std_name TEXT;
    v_std_nim TEXT;
    v_status_text TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT u.full_name, u.username INTO v_std_name, v_std_nim
    FROM public.attendance_logs al JOIN public.users u ON al.custom_user_id = u.id
    WHERE al.id = p_log_id;

    v_status_text := CASE WHEN p_is_approved THEN 'Menyetujui' ELSE 'Menolak' END;

    IF p_type = 'license' THEN
        UPDATE public.attendance_logs SET
            verification_status = CASE WHEN p_is_approved THEN 'approved' ELSE 'rejected' END,
            is_verified = p_is_approved
        WHERE id = p_log_id;
        
        PERFORM public.log_activity(
            p_caller_id, 
            'VALIDATE_ATTENDANCE', 
            v_status_text || ' pengajuan izin absensi untuk mahasiswa ' || COALESCE(v_std_name, '') || ' (' || COALESCE(v_std_nim, '') || ')', 
            jsonb_build_object('log_id', p_log_id, 'is_approved', p_is_approved, 'type', p_type)
        );
    ELSIF p_type = 'reschedule' THEN
        UPDATE public.attendance_logs SET
            reschedule_status = CASE WHEN p_is_approved THEN 'approved' ELSE 'rejected' END,
            reschedule_schedule_id = CASE WHEN p_is_approved THEN reschedule_schedule_id ELSE NULL END
        WHERE id = p_log_id;
        
        PERFORM public.log_activity(
            p_caller_id, 
            'VALIDATE_ATTENDANCE', 
            v_status_text || ' pengajuan reschedule absensi untuk mahasiswa ' || COALESCE(v_std_name, '') || ' (' || COALESCE(v_std_nim, '') || ')', 
            jsonb_build_object('log_id', p_log_id, 'is_approved', p_is_approved, 'type', p_type)
        );
    END IF;
END; $$;

-- 4.15. upsert_schedule_assignment_secure
DROP FUNCTION IF EXISTS public.upsert_schedule_assignment_secure(BIGINT, BIGINT, UUID, BIGINT, TEXT, TEXT, DATE);
CREATE OR REPLACE FUNCTION public.upsert_schedule_assignment_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_schedule_id UUID,
    p_user_id BIGINT,
    p_task_role TEXT,
    p_activity_name TEXT,
    p_activity_date DATE
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_asst_name TEXT;
    v_sched_title TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    SELECT full_name INTO v_asst_name FROM public.users WHERE id = p_user_id;
    SELECT title INTO v_sched_title FROM public.schedules WHERE id = p_schedule_id;

    IF p_id IS NULL OR p_id = 0 THEN
        INSERT INTO public.schedule_assignments (schedule_id, user_id, task_role, activity_name, activity_date, status)
        VALUES (p_schedule_id, p_user_id, p_task_role, p_activity_name, p_activity_date, 'aktif');
        
        PERFORM public.log_activity(
            p_caller_id, 
            'GUARD_SCHEDULE', 
            'Membuat jadwal jaga baru untuk ' || COALESCE(v_asst_name, 'ID ' || p_user_id::TEXT) || ' sebagai ' || p_task_role || ' pada ' || p_activity_date::TEXT || ' (' || COALESCE(v_sched_title, 'Jadwal ID ' || p_schedule_id::TEXT) || ')', 
            jsonb_build_object('schedule_id', p_schedule_id, 'user_id', p_user_id, 'task_role', p_task_role, 'date', p_activity_date)
        );
    ELSE
        UPDATE public.schedule_assignments SET
            schedule_id = p_schedule_id,
            user_id = p_user_id,
            task_role = p_task_role,
            activity_name = p_activity_name,
            activity_date = p_activity_date
        WHERE id = p_id;
        
        PERFORM public.log_activity(
            p_caller_id, 
            'GUARD_SCHEDULE', 
            'Mengubah jadwal jaga ID ' || p_id::TEXT || ' untuk ' || COALESCE(v_asst_name, 'ID ' || p_user_id::TEXT) || ' sebagai ' || p_task_role || ' pada ' || p_activity_date::TEXT, 
            jsonb_build_object('id', p_id, 'schedule_id', p_schedule_id, 'user_id', p_user_id, 'task_role', p_task_role, 'date', p_activity_date)
        );
    END IF;
END; $$;

-- 4.16. delete_schedule_assignment_secure
DROP FUNCTION IF EXISTS public.delete_schedule_assignment_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.delete_schedule_assignment_secure(
    p_caller_id BIGINT,
    p_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_asst_name TEXT;
    v_task_role TEXT;
    v_date DATE;
    v_user_id BIGINT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    SELECT user_id, task_role, activity_date INTO v_user_id, v_task_role, v_date
    FROM public.schedule_assignments WHERE id = p_id;

    SELECT full_name INTO v_asst_name FROM public.users WHERE id = v_user_id;

    DELETE FROM public.schedule_assignments WHERE id = p_id;

    PERFORM public.log_activity(
        p_caller_id, 
        'GUARD_SCHEDULE', 
        'Menghapus jadwal jaga ' || COALESCE(v_task_role, '') || ' untuk ' || COALESCE(v_asst_name, 'ID ' || v_user_id::TEXT) || ' tanggal ' || COALESCE(v_date::TEXT, ''), 
        jsonb_build_object('id', p_id, 'user_id', v_user_id, 'task_role', v_task_role, 'date', v_date)
    );
END; $$;

-- 4.17. approve_swap_secure
DROP FUNCTION IF EXISTS public.approve_swap_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.approve_swap_secure(
    p_caller_id BIGINT,
    p_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sub_id BIGINT;
    v_orig_id BIGINT;
    v_sub_name TEXT;
    v_orig_name TEXT;
    v_date DATE;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat menyetujui swap.';
    END IF;

    SELECT user_id, substitute_user_id, activity_date INTO v_orig_id, v_sub_id, v_date
    FROM public.schedule_assignments WHERE id = p_id;

    IF v_sub_id IS NULL THEN
        RAISE EXCEPTION 'Tidak ada pengunganti yang terdaftar.';
    END IF;

    SELECT full_name INTO v_orig_name FROM public.users WHERE id = v_orig_id;
    SELECT full_name INTO v_sub_name FROM public.users WHERE id = v_sub_id;

    UPDATE public.schedule_assignments SET 
        user_id = v_sub_id, 
        original_user_id = v_orig_id, 
        substitute_user_id = NULL, 
        status = 'aktif' 
    WHERE id = p_id;

    PERFORM public.log_activity(
        p_caller_id, 
        'GUARD_SCHEDULE', 
        'Menyetujui pertukaran jadwal jaga (swap) tanggal ' || COALESCE(v_date::TEXT, '') || ': ' || COALESCE(v_orig_name, '') || ' digantikan oleh ' || COALESCE(v_sub_name, ''), 
        jsonb_build_object('id', p_id, 'original_user_id', v_orig_id, 'substitute_user_id', v_sub_id, 'date', v_date)
    );
END; $$;

-- 4.18. update_swap_status_secure
DROP FUNCTION IF EXISTS public.update_swap_status_secure(BIGINT, BIGINT, TEXT, BIGINT);
CREATE OR REPLACE FUNCTION public.update_swap_status_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_status TEXT,
    p_substitute_id BIGINT
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

-- 5. GRANTS
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
