-- =====================================================
-- Migration: Master Production Sync & Type Alignment
-- Date: 2026-04-17
-- Resolve: RPC 400 (Type Mismatch) + Schema Missing Columns
-- =====================================================

-- 1. SCHEMA REPAIR: Ensure elearning_progress table is up to date
DO $$ 
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elearning_progress' AND column_name='current_level') THEN
        ALTER TABLE public.elearning_progress ADD COLUMN current_level TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elearning_progress' AND column_name='completed_levels') THEN
        ALTER TABLE public.elearning_progress ADD COLUMN completed_levels JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elearning_progress' AND column_name='completed_lessons') THEN
        -- Check if it exists as singular version first to migrate it
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elearning_progress' AND column_name='completed_lesson') THEN
             ALTER TABLE public.elearning_progress RENAME COLUMN completed_lesson TO completed_lessons;
        ELSE
             ALTER TABLE public.elearning_progress ADD COLUMN completed_lessons INTEGER NOT NULL DEFAULT 0;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elearning_progress' AND column_name='total_lessons') THEN
        ALTER TABLE public.elearning_progress ADD COLUMN total_lessons INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='elearning_progress' AND column_name='completion_percentage') THEN
        ALTER TABLE public.elearning_progress ADD COLUMN completion_percentage NUMERIC(5,2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- 2. RESET RPCs WITH EXPLICIT TABLE RETURNS (NO SETOF RECORD)
-- PostgREST requires explicit column definitions for JSON mapping.

-- 2.1: Fetch Attendance Logs Securely
DROP FUNCTION IF EXISTS public.get_attendance_logs_secure(BIGINT);
DROP FUNCTION IF EXISTS public.get_attendance_logs_secure(INTEGER);

CREATE OR REPLACE FUNCTION public.get_attendance_logs_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    status TEXT,
    notes TEXT,
    check_in_time TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN,
    verification_status TEXT,
    reschedule_status TEXT,
    reschedule_schedule_id UUID,
    user_id BIGINT,
    user_full_name TEXT,
    user_role TEXT,
    user_username TEXT,
    user_major TEXT,
    user_class_code TEXT,
    user_shift TEXT,
    user_phone_number TEXT,
    schedule_title TEXT,
    schedule_day TEXT,
    schedule_time TIME
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.is_staff(p_viewer_id) OR public.is_pj_absen_today(p_viewer_id) THEN
        RETURN QUERY 
        SELECT al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time::TIMESTAMP WITH TIME ZONE, al.is_verified::BOOLEAN, al.verification_status::TEXT, al.reschedule_status::TEXT, al.reschedule_schedule_id::UUID,
               u.id::BIGINT as user_id, u.full_name::TEXT as user_full_name, u.role::TEXT as user_role, u.username::TEXT as user_username, u.division::TEXT as user_major, u.class_code::TEXT as user_class_code, u.shift::TEXT as user_shift, u.phone_number::TEXT as user_phone_number,
               s.title::TEXT as schedule_title, s.day_of_week::TEXT as schedule_day, s.start_time::TIME as schedule_time
        FROM public.attendance_logs al
        JOIN public.users u ON al.custom_user_id = u.id
        LEFT JOIN public.schedules s ON al.reschedule_schedule_id = s.id
        ORDER BY al.check_in_time DESC;
    ELSE
        RETURN QUERY 
        SELECT al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time::TIMESTAMP WITH TIME ZONE, al.is_verified::BOOLEAN, al.verification_status::TEXT, al.reschedule_status::TEXT, al.reschedule_schedule_id::UUID,
               u.id::BIGINT as user_id, u.full_name::TEXT as user_full_name, u.role::TEXT as user_role, u.username::TEXT as user_username, u.division::TEXT as user_major, u.class_code::TEXT as user_class_code, u.shift::TEXT as user_shift, u.phone_number::TEXT as user_phone_number,
               s.title::TEXT as schedule_title, s.day_of_week::TEXT as schedule_day, s.start_time::TIME as schedule_time
        FROM public.attendance_logs al
        JOIN public.users u ON al.custom_user_id = u.id
        LEFT JOIN public.schedules s ON al.reschedule_schedule_id = s.id
        WHERE al.custom_user_id = p_viewer_id
        ORDER BY al.check_in_time DESC;
    END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.get_attendance_logs_secure(p_viewer_id INTEGER)
RETURNS TABLE (
    id BIGINT, status TEXT, notes TEXT, check_in_time TIMESTAMP WITH TIME ZONE, is_verified BOOLEAN, verification_status TEXT, reschedule_status TEXT, reschedule_schedule_id UUID, user_id BIGINT, user_full_name TEXT, user_role TEXT, user_username TEXT, user_major TEXT, user_class_code TEXT, user_shift TEXT, user_phone_number TEXT, schedule_title TEXT, schedule_day TEXT, schedule_time TIME
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.get_attendance_logs_secure(p_viewer_id::BIGINT);
END; $$;

-- 2.2: E-Learning Progress Securely
DROP FUNCTION IF EXISTS public.get_elearning_progress_secure(BIGINT);
DROP FUNCTION IF EXISTS public.get_elearning_progress_secure(INTEGER);

CREATE OR REPLACE FUNCTION public.get_elearning_progress_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id UUID,
    nim TEXT,
    student_name TEXT,
    completed_lessons INTEGER,
    total_lessons INTEGER,
    completion_percentage DECIMAL,
    is_completed BOOLEAN,
    completed_levels JSONB,
    current_level TEXT,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_nim TEXT;
BEGIN
    SELECT u.username INTO v_user_nim FROM public.users u WHERE u.id = p_viewer_id;
    
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT ep.id::UUID, ep.nim::TEXT, u.full_name::TEXT as student_name, ep.completed_lessons::INTEGER, ep.total_lessons::INTEGER, ep.completion_percentage::DECIMAL, ep.is_completed::BOOLEAN, ep.completed_levels::JSONB, ep.current_level::TEXT, ep.last_accessed_at::TIMESTAMP WITH TIME ZONE, ep.created_at::TIMESTAMP WITH TIME ZONE, ep.updated_at::TIMESTAMP WITH TIME ZONE
        FROM public.elearning_progress ep
        LEFT JOIN public.users u ON ep.nim = u.username;
    ELSE
        RETURN QUERY 
        SELECT ep.id::UUID, ep.nim::TEXT, u.full_name::TEXT as student_name, ep.completed_lessons::INTEGER, ep.total_lessons::INTEGER, ep.completion_percentage::DECIMAL, ep.is_completed::BOOLEAN, ep.completed_levels::JSONB, ep.current_level::TEXT, ep.last_accessed_at::TIMESTAMP WITH TIME ZONE, ep.created_at::TIMESTAMP WITH TIME ZONE, ep.updated_at::TIMESTAMP WITH TIME ZONE
        FROM public.elearning_progress ep 
        LEFT JOIN public.users u ON ep.nim = u.username
        WHERE ep.nim = v_user_nim;
    END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.get_elearning_progress_secure(p_viewer_id INTEGER)
RETURNS TABLE (
    id UUID, nim TEXT, student_name TEXT, completed_lessons INTEGER, total_lessons INTEGER, completion_percentage DECIMAL, is_completed BOOLEAN, completed_levels JSONB, current_level TEXT, last_accessed_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.get_elearning_progress_secure(p_viewer_id::BIGINT);
END; $$;

-- 2.3: Personal Schedule Management
DROP FUNCTION IF EXISTS public.get_personal_schedules_secure(BIGINT);
DROP FUNCTION IF EXISTS public.get_personal_schedules_secure(INTEGER);

CREATE OR REPLACE FUNCTION public.get_personal_schedules_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    role TEXT,
    schedule_id UUID,
    schedule_title TEXT,
    schedule_day TEXT,
    schedule_start TIME,
    schedule_end TIME,
    schedule_major TEXT,
    schedule_class TEXT,
    student_id BIGINT,
    student_name TEXT,
    student_nim TEXT,
    student_shift TEXT,
    assistant_id BIGINT,
    assistant_name TEXT,
    assistant_phone TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT u.role INTO v_role FROM public.users u WHERE u.id = p_viewer_id;

    IF v_role = 'praktikan' THEN
        RETURN QUERY
        SELECT v_role::TEXT as role, s.id::UUID as schedule_id, s.title::TEXT as schedule_title, s.day_of_week::TEXT as schedule_day, s.start_time::TIME as schedule_start, s.end_time::TIME as schedule_end, s.major::TEXT as schedule_major, s.class_code::TEXT as schedule_class,
               u.id::BIGINT as student_id, u.full_name::TEXT as student_name, u.username::TEXT as student_nim, u.shift::TEXT as student_shift,
               a.id::BIGINT as assistant_id, a.full_name::TEXT as assistant_name, a.phone_number::TEXT as assistant_phone
        FROM public.group_members gm
        JOIN public.schedules s ON gm.schedule_id = s.id
        JOIN public.users u ON gm.student_id = u.id
        LEFT JOIN public.users a ON gm.assistant_id = a.id
        WHERE gm.student_id = p_viewer_id;
    ELSIF v_role IN ('asisten', 'koordinator', 'sekretaris', 'k3') THEN
        RETURN QUERY
        SELECT v_role::TEXT as role, s.id::UUID as schedule_id, s.title::TEXT as schedule_title, s.day_of_week::TEXT as schedule_day, s.start_time::TIME as schedule_start, s.end_time::TIME as schedule_end, s.major::TEXT as schedule_major, s.class_code::TEXT as schedule_class,
               stu.id::BIGINT as student_id, stu.full_name::TEXT as student_name, stu.username::TEXT as student_nim, stu.shift::TEXT as student_shift,
               asst.id::BIGINT as assistant_id, asst.full_name::TEXT as assistant_name, asst.phone_number::TEXT as assistant_phone
        FROM public.group_assistants ga
        JOIN public.schedules s ON ga.schedule_id = s.id
        JOIN public.users asst ON ga.assistant_id = asst.id
        LEFT JOIN public.group_members gm ON ga.schedule_id = gm.schedule_id AND ga.assistant_id = gm.assistant_id
        LEFT JOIN public.users stu ON gm.student_id = stu.id
        WHERE ga.assistant_id = p_viewer_id;
    END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.get_personal_schedules_secure(p_viewer_id INTEGER)
RETURNS TABLE (
    role TEXT, schedule_id UUID, schedule_title TEXT, schedule_day TEXT, schedule_start TIME, schedule_end TIME, schedule_major TEXT, schedule_class TEXT, student_id BIGINT, student_name TEXT, student_nim TEXT, student_shift TEXT, assistant_id BIGINT, assistant_name TEXT, assistant_phone TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.get_personal_schedules_secure(p_viewer_id::BIGINT);
END; $$;

-- 2.4 Dashboard Stats
DROP FUNCTION IF EXISTS public.get_dashboard_stats_secure(BIGINT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats_secure(INTEGER);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats_secure(p_viewer_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_stats JSONB;
    v_phone TEXT;
BEGIN
    SELECT u.phone_number INTO v_phone FROM public.users u WHERE u.id = p_viewer_id;

    IF public.is_staff(p_viewer_id) THEN
        SELECT jsonb_build_object(
            'user_phone', v_phone,
            'total_users', (SELECT count(*) FROM public.users),
            'total_students', (SELECT count(*) FROM public.users WHERE role = 'praktikan'),
            'total_assistants', (SELECT count(*) FROM public.users WHERE role = 'asisten'),
            'total_schedules', (SELECT count(*) FROM public.schedules WHERE type = 'praktikum'),
            'pending_attendance', (SELECT count(*) FROM public.attendance_logs WHERE verification_status = 'pending'),
            'total_feedback', (SELECT count(*) FROM public.feedback)
        ) INTO v_stats;
    ELSE
        SELECT jsonb_build_object(
            'user_phone', v_phone,
            'my_attendance', (SELECT count(*) FROM public.attendance_logs WHERE custom_user_id = p_viewer_id AND status = 'Hadir'),
            'attendance_rate', (
                SELECT CASE WHEN count(*) = 0 THEN 0 ELSE ROUND((COUNT(*) FILTER (WHERE status = 'Hadir')::DECIMAL / count(*)) * 100) END 
                FROM public.attendance_logs WHERE custom_user_id = p_viewer_id
            ),
            'total_kelas', (SELECT count(*) FROM public.group_members WHERE student_id = p_viewer_id),
            'total_feedback', (SELECT count(*) FROM public.feedback WHERE custom_user_id = p_viewer_id)
        ) INTO v_stats;
    END IF;
    
    RETURN v_stats;
END; $$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats_secure(p_viewer_id INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN public.get_dashboard_stats_secure(p_viewer_id::BIGINT);
END; $$;
