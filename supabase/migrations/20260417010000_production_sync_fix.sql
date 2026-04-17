-- =====================================================
-- Migration: ULTIMATE MASTER REPAIR (V6)
-- Resolve: Schema Mismatch, Missing RPCs, Dashboard Approval Counts
-- =====================================================

-- 0. SCHEMA REPAIR: Add Missing Columns
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 1. UTILITY: Helper to Drop All Overloads (V6 Edition)
DO $$ DECLARE
    r record;
BEGIN
    FOR r IN (SELECT proname, oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace 
              AND proname IN (
                  'check_menu_access_secure', 'get_dashboard_stats_secure', 
                  'get_system_settings_full_secure', 'admin_update_global_settings_secure',
                  'get_attendance_logs_secure'
              ))
    LOOP
        EXECUTE 'DROP FUNCTION public.' || r.proname || '(' || pg_get_function_identity_arguments(r.oid) || ') CASCADE';
    END LOOP;
END $$;

-- 2. ACCESS CONTROL
CREATE OR REPLACE FUNCTION public.check_menu_access_secure(p_viewer_id BIGINT, p_menu_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
    SELECT u.role INTO v_role FROM public.users u WHERE u.id = p_viewer_id;
    
    -- Koordinator access all
    IF v_role = 'koordinator' THEN RETURN TRUE; END IF;
    
    -- Basic Role Mapping
    CASE p_menu_key
        WHEN '/manajemen-user' THEN RETURN v_role IN ('koordinator', 'sekretaris');
        WHEN '/manajemen-kelas' THEN RETURN v_role IN ('koordinator', 'asisten', 'sekretaris');
        WHEN '/laporan-keuangan' THEN RETURN v_role IN ('koordinator', 'sekretaris');
        WHEN '/inventaris' THEN RETURN v_role IN ('koordinator', 'asisten', 'sekretaris', 'k3');
        WHEN '/absensi' THEN RETURN TRUE; -- All roles can access attendance
        ELSE RETURN TRUE; -- Default to true for shared pages
    END CASE;
END; $$;

-- 3. DASHBOARD STATS (UPGRADED)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_secure(p_viewer_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role TEXT; v_full_name TEXT; v_phone TEXT;
    v_total_users BIGINT; v_total_assistants BIGINT; v_total_students BIGINT;
    v_total_feedback BIGINT; v_pending_approval BIGINT;
    v_my_classes BIGINT; v_my_students BIGINT; v_attendance_rate DECIMAL;
BEGIN
    SELECT u.role, u.full_name, u.phone_number INTO v_role, v_full_name, v_phone FROM public.users u WHERE u.id = p_viewer_id;
    
    -- Global Counts (Staff Only)
    SELECT COUNT(*) INTO v_total_users FROM public.users;
    SELECT COUNT(*) INTO v_total_assistants FROM public.users WHERE role IN ('asisten', 'koordinator');
    SELECT COUNT(*) INTO v_total_students FROM public.users WHERE role = 'praktikan';
    SELECT COUNT(*) INTO v_total_feedback FROM public.feedback;
    
    -- NEW: Aggregated Pending Approval (Izin, Sakit, Reschedule)
    SELECT COUNT(*) INTO v_pending_approval FROM public.attendance_logs 
    WHERE verification_status = 'pending' AND (type IN ('izin', 'sakit', 'reschedule') OR status != 'Hadir');
    
    -- Role Specific
    IF v_role = 'praktikan' THEN
        SELECT COUNT(*) INTO v_my_classes FROM public.group_members WHERE student_id = p_viewer_id;
        SELECT COALESCE(ROUND((COUNT(*) FILTER (WHERE status = 'Hadir') * 100.0) / NULLIF(COUNT(*), 0), 1), 0) 
        INTO v_attendance_rate FROM public.attendance_logs WHERE custom_user_id = p_viewer_id;
    ELSE
        SELECT COUNT(*) INTO v_my_classes FROM public.group_assistants WHERE assistant_id = p_viewer_id;
        SELECT COUNT(*) INTO v_my_students FROM public.group_members WHERE assistant_id = p_viewer_id;
    END IF;

    RETURN jsonb_build_object(
        'user_role', v_role, 'user_name', v_full_name, 'user_phone', v_phone,
        'total_users', v_total_users, 'total_assistants', v_total_assistants, 'total_students', v_total_students,
        'total_feedback', v_total_feedback, 'pending_approval', v_pending_approval,
        'total_kelas', v_my_classes, 'total_students_under_me', v_my_students, 
        'attendance_rate', v_attendance_rate
    );
END; $$;

-- 4. SYSTEM SETTINGS
CREATE OR REPLACE FUNCTION public.get_system_settings_full_secure(p_viewer_id BIGINT)
RETURNS TABLE (semester_active TEXT, announcement TEXT, is_recruitment_open BOOLEAN) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Only Koordinator or Sekretaris
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer_id AND role IN ('koordinator', 'sekretaris')) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;
    RETURN QUERY SELECT ss.semester_active, ss.announcement, ss.is_recruitment_open FROM public.system_settings ss LIMIT 1;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_global_settings_secure(p_caller_id BIGINT, p_semester_active TEXT, p_announcement TEXT, p_is_recruitment_open BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_id AND role = 'koordinator') THEN
        RAISE EXCEPTION 'Only Koordinator can change system settings';
    END IF;
    
    UPDATE public.system_settings 
    SET semester_active = p_semester_active, announcement = p_announcement, is_recruitment_open = p_is_recruitment_open, updated_at = now();
END; $$;

-- 5. ATTENDANCE (FIXED FILTER)
CREATE OR REPLACE FUNCTION public.get_attendance_logs_secure(p_viewer_id BIGINT, p_date_filter DATE DEFAULT NULL)
RETURNS TABLE (
    id BIGINT, status TEXT, notes TEXT, check_in_time TIMESTAMP WITH TIME ZONE, is_verified BOOLEAN, verification_status TEXT, reschedule_status TEXT, reschedule_schedule_id TEXT, user_id BIGINT, user_full_name TEXT, user_role TEXT, user_username TEXT, user_major TEXT, user_class_code TEXT, user_shift TEXT, user_phone_number TEXT, schedule_title TEXT, schedule_day TEXT, schedule_time TIME, type TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time::TIMESTAMP WITH TIME ZONE, al.is_verified::BOOLEAN, al.verification_status::TEXT, al.reschedule_status::TEXT, al.reschedule_schedule_id::TEXT, u.id::BIGINT, u.full_name::TEXT, u.role::TEXT, u.username::TEXT, u.division::TEXT, u.class_code::TEXT, u.shift::TEXT, u.phone_number::TEXT, s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME, al.type::TEXT
    FROM public.attendance_logs al 
    JOIN public.users u ON al.custom_user_id = u.id 
    LEFT JOIN public.schedules s ON al.reschedule_schedule_id::TEXT = s.id::TEXT
    WHERE (public.is_staff(p_viewer_id) OR al.custom_user_id = p_viewer_id)
      AND (p_date_filter IS NULL OR al.check_in_time::DATE = p_date_filter)
    ORDER BY al.check_in_time DESC;
END; $$;
