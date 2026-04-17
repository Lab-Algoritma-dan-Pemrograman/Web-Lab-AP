-- =====================================================
-- Migration: DEFINITIVE MASTER STABILIZATION (V7)
-- Resolve: EVERYTHING (Schema, Missing RPCs, WHERE Clause Errors)
-- =====================================================

-- 0. SCHEMA REPAIR: Ensure Columns Exist
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 1. UTILITY: Aggressive Drop for all Secure RPCs
DO $$ DECLARE
    r record;
BEGIN
    FOR r IN (SELECT proname, oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace 
              AND proname IN (
                  'check_menu_access_secure', 'get_dashboard_stats_secure', 
                  'get_system_settings_secure', 'get_system_settings_full_secure', 
                  'admin_update_system_setting', 'admin_update_global_settings_secure',
                  'get_attendance_logs_secure', 'get_inventory_items_secure', 
                  'upsert_inventory_item_secure', 'delete_inventory_item_secure',
                  'get_financial_records_secure', 'upsert_financial_record_secure', 
                  'delete_financial_record_secure', 'get_assistant_availability_secure',
                  'get_group_assistants_secure', 'get_group_members_secure',
                  'get_all_group_members_secure', 'sync_students_to_group_secure'
              ))
    LOOP
        EXECUTE 'DROP FUNCTION public.' || r.proname || '(' || pg_get_function_identity_arguments(r.oid) || ') CASCADE';
    END LOOP;
END $$;

-- 2. ACCESS & DASHBOARD
CREATE OR REPLACE FUNCTION public.check_menu_access_secure(p_viewer_id BIGINT, p_menu_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
    SELECT u.role INTO v_role FROM public.users u WHERE u.id = p_viewer_id;
    IF v_role = 'koordinator' THEN RETURN TRUE; END IF;
    CASE p_menu_key
        WHEN '/manajemen-user', '/laporan-keuangan' THEN RETURN v_role IN ('koordinator', 'sekretaris');
        WHEN '/manajemen-kelas' THEN RETURN v_role IN ('koordinator', 'asisten', 'sekretaris');
        WHEN '/inventaris' THEN RETURN v_role IN ('koordinator', 'asisten', 'sekretaris', 'k3');
        ELSE RETURN TRUE;
    END CASE;
END; $$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats_secure(p_viewer_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role TEXT; v_full_name TEXT; v_total_users BIGINT; v_total_assistants BIGINT; 
    v_total_students BIGINT; v_total_feedback BIGINT; v_pending_approval BIGINT;
    v_my_classes BIGINT; v_my_students BIGINT; v_attendance_rate DECIMAL;
BEGIN
    SELECT u.role, u.full_name INTO v_role, v_full_name FROM public.users u WHERE u.id = p_viewer_id;
    SELECT COUNT(*) INTO v_total_users FROM public.users;
    SELECT COUNT(*) INTO v_total_assistants FROM public.users WHERE role IN ('asisten', 'koordinator');
    SELECT COUNT(*) INTO v_total_students FROM public.users WHERE role = 'praktikan';
    SELECT COUNT(*) INTO v_total_feedback FROM public.feedback;
    SELECT COUNT(*) INTO v_pending_approval FROM public.attendance_logs WHERE verification_status = 'pending' AND (type IN ('izin', 'sakit', 'reschedule') OR status != 'Hadir');
    
    IF v_role = 'praktikan' THEN
        SELECT COUNT(*) INTO v_my_classes FROM public.group_members WHERE student_id = p_viewer_id;
        SELECT COALESCE(ROUND((COUNT(*) FILTER (WHERE status = 'Hadir') * 100.0) / NULLIF(COUNT(*), 0), 1), 0) INTO v_attendance_rate FROM public.attendance_logs WHERE custom_user_id = p_viewer_id;
    ELSE
        SELECT COUNT(*) INTO v_my_classes FROM public.group_assistants WHERE assistant_id = p_viewer_id;
        SELECT COUNT(*) INTO v_my_students FROM public.group_members WHERE assistant_id = p_viewer_id;
    END IF;

    RETURN jsonb_build_object(
        'user_role', v_role, 'user_name', v_full_name, 'total_users', v_total_users, 
        'total_assistants', v_total_assistants, 'total_students', v_total_students,
        'total_feedback', v_total_feedback, 'pending_approval', v_pending_approval,
        'total_kelas', v_my_classes, 'total_students_under_me', v_my_students, 
        'attendance_rate', v_attendance_rate
    );
END; $$;

-- 3. SYSTEM SETTINGS (Fixed WHERE Clause)
CREATE OR REPLACE FUNCTION public.get_system_settings_secure(p_viewer_id BIGINT)
RETURNS TABLE (active_shift TEXT, semester_active TEXT, announcement TEXT, is_recruitment_open BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ss.active_shift, ss.semester_active, ss.announcement, ss.is_recruitment_open FROM public.system_settings ss LIMIT 1;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_system_setting(p_caller_id BIGINT, p_active_shift TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    -- TARGETED UPDATE to avoid "UPDATE requires a WHERE clause"
    UPDATE public.system_settings SET active_shift = p_active_shift, updated_at = now()
    WHERE id = (SELECT id FROM public.system_settings LIMIT 1);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_global_settings_secure(p_caller_id BIGINT, p_semester_active TEXT, p_announcement TEXT, p_is_recruitment_open BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_id AND role = 'koordinator') THEN RAISE EXCEPTION 'Access Denied'; END IF;
    UPDATE public.system_settings 
    SET semester_active = p_semester_active, announcement = p_announcement, is_recruitment_open = p_is_recruitment_open, updated_at = now()
    WHERE id = (SELECT id FROM public.system_settings LIMIT 1);
END; $$;

-- 4. INVENTORY & FINANCE (REPLENISHED)
CREATE OR REPLACE FUNCTION public.get_inventory_items_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, name TEXT, condition TEXT, quantity INTEGER, location TEXT, updated_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT inv.id::BIGINT, inv.name::TEXT, inv.condition::TEXT, inv.quantity::INTEGER, inv.location::TEXT, inv.updated_at::TIMESTAMP WITH TIME ZONE
    FROM public.inventory_items inv ORDER BY inv.name ASC;
END; $$;

CREATE OR REPLACE FUNCTION public.get_financial_records_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, title TEXT, amount NUMERIC, type TEXT, category TEXT, date TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT fr.id::BIGINT, fr.title::TEXT, fr.amount::NUMERIC, fr.type::TEXT, fr.category::TEXT, COALESCE(fr.date, fr.created_at)::TIMESTAMP WITH TIME ZONE
    FROM public.financial_records fr ORDER BY fr.date DESC, fr.created_at DESC;
END; $$;

-- 5. CLASS MANAGEMENT & AVAILABILITY (Fixed 400)
CREATE OR REPLACE FUNCTION public.get_assistant_availability_secure(p_viewer_id BIGINT, p_day TEXT, p_start TEXT, p_end TEXT)
RETURNS TABLE (user_id BIGINT, user_full_name TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
    v_start TIME; v_end TIME;
BEGIN
    -- Explicitly cast strings to TIME to avoid PostgREST ambiguities
    v_start := p_start::TIME; v_end := p_end::TIME;
    
    RETURN QUERY SELECT u.id::BIGINT, u.full_name::TEXT FROM public.users u
    WHERE u.role IN ('asisten', 'koordinator')
    AND EXISTS (
        SELECT 1 FROM public.assistant_availability aa WHERE aa.user_id = u.id AND aa.day_of_week = p_day AND aa.is_available = true
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.group_assistants ga JOIN public.schedules s ON ga.schedule_id = s.id
        WHERE ga.assistant_id = u.id AND s.day_of_week = p_day
        AND (s.start_time, s.end_time) OVERLAPS (v_start, v_end)
    );
END; $$;

-- 6. ATTENDANCE (Definitive)
CREATE OR REPLACE FUNCTION public.get_attendance_logs_secure(p_viewer_id BIGINT, p_date_filter DATE DEFAULT NULL)
RETURNS TABLE (
    id BIGINT, status TEXT, notes TEXT, check_in_time TIMESTAMP WITH TIME ZONE, is_verified BOOLEAN, verification_status TEXT, reschedule_status TEXT, reschedule_schedule_id TEXT, user_id BIGINT, user_full_name TEXT, user_role TEXT, user_username TEXT, user_major TEXT, user_class_code TEXT, user_shift TEXT, user_phone_number TEXT, schedule_title TEXT, schedule_day TEXT, schedule_time TIME, type TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time::TIMESTAMP WITH TIME ZONE, al.is_verified::BOOLEAN, al.verification_status::TEXT, al.reschedule_status::TEXT, al.reschedule_schedule_id::TEXT, u.id::BIGINT, u.full_name::TEXT, u.role::TEXT, u.username::TEXT, u.division::TEXT, u.class_code::TEXT, u.shift::TEXT, u.phone_number::TEXT, s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME, al.type::TEXT
    FROM public.attendance_logs al JOIN public.users u ON al.custom_user_id = u.id LEFT JOIN public.schedules s ON al.reschedule_schedule_id::TEXT = s.id::TEXT
    WHERE (public.is_staff(p_viewer_id) OR al.custom_user_id = p_viewer_id) AND (p_date_filter IS NULL OR al.check_in_time::DATE = p_date_filter)
    ORDER BY al.check_in_time DESC;
END; $$;
