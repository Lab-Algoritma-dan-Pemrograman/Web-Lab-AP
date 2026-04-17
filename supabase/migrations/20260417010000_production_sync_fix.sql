-- =====================================================
-- Migration: ULTIMATE PRODUCTION REPAIR (V4 - RESILIENT)
-- Resolve: PGRST203, 42804, 42846, 42703 (All sync issues)
-- =====================================================

-- 1. REPAIR TABLE SCHEMAS (Idempotent)
DO $$ BEGIN
    -- Add missing columns to elearning_progress
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elearning_progress' AND column_name='current_level') THEN
        ALTER TABLE public.elearning_progress ADD COLUMN current_level TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elearning_progress' AND column_name='completed_levels') THEN
        ALTER TABLE public.elearning_progress ADD COLUMN completed_levels JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elearning_progress' AND column_name='last_accessed_at') THEN
        ALTER TABLE public.elearning_progress ADD COLUMN last_accessed_at TIMESTAMP WITH TIME ZONE;
    END IF;
    -- Fix misspelled column if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elearning_progress' AND column_name='completed_lesson') THEN
        ALTER TABLE public.elearning_progress RENAME COLUMN completed_lesson TO completed_lessons;
    END IF;
END $$;

-- 2. NUCLEAR DROP (Remove ALL possible candidates)
-- This ensures PostgREST doesn't get confused by ANY old version.
DROP FUNCTION IF EXISTS public.get_attendance_logs_secure(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_attendance_logs_secure(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_elearning_progress_secure(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_elearning_progress_secure(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_personal_schedules_secure(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_personal_schedules_secure(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_stats_secure(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_stats_secure(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_schedules_secure(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_schedules_secure(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_deletion_history_secure(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_deletion_history_secure(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_schedule_assignments_secure(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_schedule_assignments_secure(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_system_settings_secure(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_system_settings_secure(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_assistant_contact_secure(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_assistant_contact_secure(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.check_menu_access_secure(BIGINT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_menu_access_secure(INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_financial_records_secure(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.get_financial_records_secure(INTEGER) CASCADE;

-- 3. RE-IMPLEMENT WITH EXPLICIT CASTING & BIGINT COMPATIBILITY

-- 3.1: Financial Records
CREATE OR REPLACE FUNCTION public.get_financial_records_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, title TEXT, amount NUMERIC, type TEXT, category TEXT, date TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT fr.id::BIGINT, fr.title::TEXT, fr.amount::NUMERIC, fr.type::TEXT, fr.category::TEXT, fr.date::TIMESTAMP WITH TIME ZONE
    FROM public.financial_records fr ORDER BY fr.date DESC;
END; $$;

-- 3.2: E-Learning Progress (Fixing code 42846 & 42703)
CREATE OR REPLACE FUNCTION public.get_elearning_progress_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id TEXT, nim TEXT, student_name TEXT, completed_lessons INTEGER, total_lessons INTEGER, completion_percentage DECIMAL, is_completed BOOLEAN, completed_levels JSONB, current_level TEXT, last_accessed_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nim TEXT;
BEGIN
    SELECT u.username INTO v_nim FROM public.users u WHERE u.id = p_viewer_id;
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY SELECT ep.id::TEXT, ep.nim::TEXT, u.full_name::TEXT, ep.completed_lessons::INTEGER, ep.total_lessons::INTEGER, ep.completion_percentage::DECIMAL, ep.is_completed::BOOLEAN, ep.completed_levels::JSONB, ep.current_level::TEXT, ep.last_accessed_at::TIMESTAMP WITH TIME ZONE
        FROM public.elearning_progress ep LEFT JOIN public.users u ON ep.nim = u.username;
    ELSE
        RETURN QUERY SELECT ep.id::TEXT, ep.nim::TEXT, u.full_name::TEXT, ep.completed_lessons::INTEGER, ep.total_lessons::INTEGER, ep.completion_percentage::DECIMAL, ep.is_completed::BOOLEAN, ep.completed_levels::JSONB, ep.current_level::TEXT, ep.last_accessed_at::TIMESTAMP WITH TIME ZONE
        FROM public.elearning_progress ep LEFT JOIN public.users u ON ep.nim = u.username WHERE ep.nim = v_nim;
    END IF;
END; $$;

-- 3.3: Schedules (Fixing code 42804 mismatch)
CREATE OR REPLACE FUNCTION public.get_schedules_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id TEXT, title TEXT, major TEXT, class_code TEXT, day_of_week TEXT, start_time TIME, end_time TIME, type TEXT, status TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT s.id::TEXT, s.title::TEXT, s.major::TEXT, s.class_code::TEXT, s.day_of_week::TEXT, s.start_time::TIME, s.end_time::TIME, s.type::TEXT, s.status::TEXT
    FROM public.schedules s;
END; $$;

-- 3.4: Attendance Logs
CREATE OR REPLACE FUNCTION public.get_attendance_logs_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT, status TEXT, notes TEXT, check_in_time TIMESTAMP WITH TIME ZONE, is_verified BOOLEAN, verification_status TEXT, reschedule_status TEXT, reschedule_schedule_id TEXT, user_id BIGINT, user_full_name TEXT, user_role TEXT, user_username TEXT, user_major TEXT, user_class_code TEXT, user_shift TEXT, user_phone_number TEXT, schedule_title TEXT, schedule_day TEXT, schedule_time TIME
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.is_staff(p_viewer_id) OR public.is_pj_absen_today(p_viewer_id) THEN
        RETURN QUERY SELECT al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time::TIMESTAMP WITH TIME ZONE, al.is_verified::BOOLEAN, al.verification_status::TEXT, al.reschedule_status::TEXT, al.reschedule_schedule_id::TEXT,
                           u.id::BIGINT, u.full_name::TEXT, u.role::TEXT, u.username::TEXT, u.division::TEXT, u.class_code::TEXT, u.shift::TEXT, u.phone_number::TEXT,
                           s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME
        FROM public.attendance_logs al JOIN public.users u ON al.custom_user_id = u.id LEFT JOIN public.schedules s ON al.reschedule_schedule_id = s.id ORDER BY al.check_in_time DESC;
    ELSE
        RETURN QUERY SELECT al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time::TIMESTAMP WITH TIME ZONE, al.is_verified::BOOLEAN, al.verification_status::TEXT, al.reschedule_status::TEXT, al.reschedule_schedule_id::TEXT,
                           u.id::BIGINT, u.full_name::TEXT, u.role::TEXT, u.username::TEXT, u.division::TEXT, u.class_code::TEXT, u.shift::TEXT, u.phone_number::TEXT,
                           s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME
        FROM public.attendance_logs al JOIN public.users u ON al.custom_user_id = u.id LEFT JOIN public.schedules s ON al.reschedule_schedule_id = s.id WHERE al.custom_user_id = p_viewer_id ORDER BY al.check_in_time DESC;
    END IF;
END; $$;

-- 3.5: Personal Schedules
CREATE OR REPLACE FUNCTION public.get_personal_schedules_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    role TEXT, schedule_id TEXT, schedule_title TEXT, schedule_day TEXT, schedule_start TIME, schedule_end TIME, schedule_major TEXT, schedule_class TEXT, student_id BIGINT, student_name TEXT, student_nim TEXT, student_shift TEXT, assistant_id BIGINT, assistant_name TEXT, assistant_phone TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
    SELECT u.role INTO v_role FROM public.users u WHERE u.id = p_viewer_id;
    IF v_role = 'praktikan' THEN
        RETURN QUERY SELECT v_role::TEXT, s.id::TEXT, s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME, s.end_time::TIME, s.major::TEXT, s.class_code::TEXT, u.id::BIGINT, u.full_name::TEXT, u.username::TEXT, u.shift::TEXT, a.id::BIGINT, a.full_name::TEXT, a.phone_number::TEXT
        FROM public.group_members gm JOIN public.schedules s ON gm.schedule_id = s.id JOIN public.users u ON gm.student_id = u.id LEFT JOIN public.users a ON gm.assistant_id = a.id WHERE gm.student_id = p_viewer_id;
    ELSE
        RETURN QUERY SELECT v_role::TEXT, s.id::TEXT, s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME, s.end_time::TIME, s.major::TEXT, s.class_code::TEXT, stu.id::BIGINT, stu.full_name::TEXT, stu.username::TEXT, stu.shift::TEXT, asst.id::BIGINT, asst.full_name::TEXT, asst.phone_number::TEXT
        FROM public.group_assistants ga JOIN public.schedules s ON ga.schedule_id = s.id JOIN public.users asst ON ga.assistant_id = asst.id LEFT JOIN public.group_members gm ON ga.schedule_id = gm.schedule_id AND ga.assistant_id = gm.assistant_id LEFT JOIN public.users stu ON gm.student_id = stu.id WHERE ga.assistant_id = p_viewer_id;
    END IF;
END; $$;

-- 3.6 Dashboard Stats
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_secure(p_viewer_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role TEXT;
    v_full_name TEXT;
    v_phone TEXT;
    v_total_users BIGINT;
    v_total_attendance BIGINT;
    v_pending_approval BIGINT;
BEGIN
    SELECT u.role, u.full_name, u.phone_number INTO v_role, v_full_name, v_phone FROM public.users u WHERE u.id = p_viewer_id;
    SELECT COUNT(*) INTO v_total_users FROM public.users;
    SELECT COUNT(*) INTO v_total_attendance FROM public.attendance_logs;
    SELECT COUNT(*) INTO v_pending_approval FROM public.attendance_logs WHERE verification_status = 'pending';

    RETURN jsonb_build_object(
        'user_role', v_role,
        'user_name', v_full_name,
        'user_phone', v_phone,
        'total_users', v_total_users,
        'total_attendance', v_total_attendance,
        'pending_approval', v_pending_approval
    );
END; $$;

-- 3.7 Deletion History
CREATE OR REPLACE FUNCTION public.get_deletion_history_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT, log_id BIGINT, target_nim TEXT, reason TEXT, deleted_by_id BIGINT, deleted_by_name TEXT, deleted_at TIMESTAMP WITH TIME ZONE, snapshot_data JSONB
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT al.id::BIGINT, al.log_id::BIGINT, al.target_nim::TEXT, al.reason::TEXT, al.deleted_by_id::BIGINT, u.full_name::TEXT, al.deleted_at::TIMESTAMP WITH TIME ZONE, al.snapshot_data::JSONB
    FROM public.attendance_deletion_logs al LEFT JOIN public.users u ON al.deleted_by_id = u.id ORDER BY al.deleted_at DESC;
END; $$;

-- 3.8 Menu Access
CREATE OR REPLACE FUNCTION public.check_menu_access_secure(p_viewer_id BIGINT, p_menu_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.assistant_menu_access ama JOIN public.users u ON ama.user_id = u.id WHERE u.id = p_viewer_id AND ama.menu_key = p_menu_key AND ama.is_enabled = true);
END; $$;

-- 3.9 Schedule Assignments
CREATE OR REPLACE FUNCTION public.get_schedule_assignments_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT, schedule_id TEXT, schedule_title TEXT, schedule_day TEXT, schedule_start TIME, schedule_end TIME, schedule_major TEXT, schedule_class_code TEXT, user_id BIGINT, user_full_name TEXT, task_role TEXT, activity_name TEXT, activity_date DATE, status TEXT, original_user_id BIGINT, original_user_full_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT sa.id::BIGINT, s.id::TEXT, s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME, s.end_time::TIME, s.major::TEXT, s.class_code::TEXT, u.id::BIGINT, u.full_name::TEXT, sa.task_role::TEXT, sa.activity_name::TEXT, sa.activity_date::DATE, sa.status::TEXT, ou.id::BIGINT, ou.full_name::TEXT
    FROM public.schedule_assignments sa JOIN public.schedules s ON sa.schedule_id = s.id JOIN public.users u ON sa.user_id = u.id LEFT JOIN public.users ou ON sa.original_user_id = ou.id ORDER BY sa.activity_date ASC;
END; $$;
