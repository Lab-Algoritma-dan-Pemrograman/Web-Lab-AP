-- =====================================================
-- Migration: Zero-Leak Hardening (Strict RLS + Secure RPCs)
-- Date: 2026-04-16
-- =====================================================

-- ==========================================
-- STEP 1: HELPER FUNCTIONS (RE-VERIFY)
-- ==========================================

-- Ensure is_admin and is_asisten exist and are secure
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role = 'koordinator' AND is_active = true);
END; $$;

CREATE OR REPLACE FUNCTION public.is_staff(p_user_id INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role IN ('asisten', 'koordinator', 'sekretaris', 'k3') AND is_active = true);
END; $$;

-- ==========================================
-- STEP 2: LOCKDOWN ALL TABLES
-- Close direct SELECT/INSERT/UPDATE for anon
-- ==========================================

DO $$ 
DECLARE 
    t TEXT;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Deny all direct anon" ON public.%I', t);
    END LOOP;
END $$;

-- Explicitly block sensitive tables for anon SELECT
DROP POLICY IF EXISTS "Block direct select" ON public.attendance_logs;
CREATE POLICY "Block direct select" ON public.attendance_logs FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "Block direct select" ON public.feedback;
CREATE POLICY "Block direct select" ON public.feedback FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "Block direct select" ON public.financial_records;
CREATE POLICY "Block direct select" ON public.financial_records FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "Block direct select" ON public.elearning_progress;
CREATE POLICY "Block direct select" ON public.elearning_progress FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "Block direct select" ON public.group_members;
CREATE POLICY "Block direct select" ON public.group_members FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "Block direct select" ON public.group_assistants;
CREATE POLICY "Block direct select" ON public.group_assistants FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "Block direct select" ON public.assistant_availability;
CREATE POLICY "Block direct select" ON public.assistant_availability FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "Block direct select" ON public.qr_sessions;
CREATE POLICY "Block direct select" ON public.qr_sessions FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "Block direct select" ON public.external_links;
CREATE POLICY "Block direct select" ON public.external_links FOR SELECT TO anon USING (false);

-- Keep some tables READABLE for anon (Needed for app initialization/UI)
DROP POLICY IF EXISTS "Public read access" ON public.system_settings;
CREATE POLICY "Public read access" ON public.system_settings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public read access" ON public.division_access;
CREATE POLICY "Public read access" ON public.division_access FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public read access" ON public.schedules;
CREATE POLICY "Public read access" ON public.schedules FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public read access" ON public.inventory_items;
CREATE POLICY "Public read access" ON public.inventory_items FOR SELECT TO anon USING (true);

-- ==========================================
-- STEP 3: SECURE FETCHING RPCs
-- ==========================================

-- 3.1: Fetch Attendance Logs Securely
CREATE OR REPLACE FUNCTION public.get_attendance_logs_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    custom_user_id BIGINT,
    check_in_time TIMESTAMP WITH TIME ZONE,
    status TEXT,
    notes TEXT,
    verification_status TEXT,
    is_verified BOOLEAN,
    reschedule_status TEXT,
    reschedule_schedule_id BIGINT,
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
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT al.id, al.custom_user_id, al.check_in_time, al.status, al.notes, 
               al.verification_status, al.is_verified, al.reschedule_status, al.reschedule_schedule_id,
               u.full_name, u.role, u.username, u.major, u.class_code, u.shift, u.phone_number,
               s.title, s.day_of_week, s.start_time
        FROM public.attendance_logs al
        JOIN public.users u ON al.custom_user_id = u.id
        LEFT JOIN public.schedules s ON al.reschedule_schedule_id = s.id
        ORDER BY al.check_in_time DESC;
    ELSE
        RETURN QUERY 
        SELECT al.id, al.custom_user_id, al.check_in_time, al.status, al.notes, 
               al.verification_status, al.is_verified, al.reschedule_status, al.reschedule_schedule_id,
               u.full_name, u.role, u.username, u.major, u.class_code, u.shift, u.phone_number,
               s.title, s.day_of_week, s.start_time
        FROM public.attendance_logs al
        JOIN public.users u ON al.custom_user_id = u.id
        LEFT JOIN public.schedules s ON al.reschedule_schedule_id = s.id
        WHERE al.custom_user_id = p_viewer_id
        ORDER BY al.check_in_time DESC;
    END IF;
END; $$;

-- 3.2: Fetch Feedback Securely
CREATE OR REPLACE FUNCTION public.get_feedback_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    custom_user_id BIGINT,
    category TEXT,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    user_full_name TEXT,
    user_username TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT f.id, f.custom_user_id, f.category, f.content, f.created_at, u.full_name, u.username
        FROM public.feedback f
        LEFT JOIN public.users u ON f.custom_user_id = u.id
        ORDER BY f.created_at DESC;
    ELSE
        RETURN QUERY 
        SELECT f.id, f.custom_user_id, f.category, f.content, f.created_at, u.full_name, u.username
        FROM public.feedback f
        LEFT JOIN public.users u ON f.custom_user_id = u.id
        WHERE f.custom_user_id = p_viewer_id
        ORDER BY f.created_at DESC;
    END IF;
END; $$;

-- 3.3: Fetch Financial Records (Staff Only)
CREATE OR REPLACE FUNCTION public.get_financial_records_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    title TEXT,
    amount DECIMAL,
    type TEXT,
    category TEXT,
    date DATE,
    created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT fr.id, fr.title, fr.amount, fr.type, fr.category, fr.date, fr.created_at 
        FROM public.financial_records fr 
        ORDER BY fr.date DESC;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END; $$;

-- 3.4: Fetch Group Members Securely
CREATE OR REPLACE FUNCTION public.get_group_members_secure(p_viewer_id BIGINT, p_schedule_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    id BIGINT,
    schedule_id BIGINT,
    student_id BIGINT,
    assistant_id BIGINT,
    student_name TEXT,
    student_nim TEXT,
    assistant_name TEXT,
    schedule_title TEXT,
    schedule_day TEXT,
    schedule_time TIME,
    schedule_class_code TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT gm.id, gm.schedule_id, gm.student_id, gm.assistant_id, 
               u_s.full_name, u_s.nim, u_a.full_name,
               s.title, s.day_of_week, s.start_time, s.class_code
        FROM public.group_members gm
        LEFT JOIN public.users u_s ON gm.student_id = u_s.id
        LEFT JOIN public.users u_a ON gm.assistant_id = u_a.id
        LEFT JOIN public.schedules s ON gm.schedule_id = s.id
        WHERE (p_schedule_id IS NULL OR gm.schedule_id = p_schedule_id);
    ELSE
        RETURN QUERY 
        SELECT gm.id, gm.schedule_id, gm.student_id, gm.assistant_id, 
               u_s.full_name, u_s.nim, u_a.full_name,
               s.title, s.day_of_week, s.start_time, s.class_code
        FROM public.group_members gm
        LEFT JOIN public.users u_s ON gm.student_id = u_s.id
        LEFT JOIN public.users u_a ON gm.assistant_id = u_a.id
        LEFT JOIN public.schedules s ON gm.schedule_id = s.id
        WHERE gm.student_id = p_viewer_id AND (p_schedule_id IS NULL OR gm.schedule_id = p_schedule_id);
    END IF;
END; $$;

-- 3.5: E-Learning Progress Securely
CREATE OR REPLACE FUNCTION public.get_elearning_progress_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    nim TEXT,
    lessons_completed INTEGER,
    total_lessons INTEGER,
    completion_percentage DECIMAL,
    is_completed BOOLEAN,
    current_level TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_nim TEXT;
BEGIN
    SELECT u.username INTO v_user_nim FROM public.users u WHERE u.id = p_viewer_id;
    
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT ep.id, ep.nim, ep.lessons_completed, ep.total_lessons, ep.completion_percentage, ep.is_completed, ep.current_level 
        FROM public.elearning_progress ep;
    ELSE
        RETURN QUERY 
        SELECT ep.id, ep.nim, ep.lessons_completed, ep.total_lessons, ep.completion_percentage, ep.is_completed, ep.current_level 
        FROM public.elearning_progress ep 
        WHERE ep.nim = v_user_nim;
    END IF;
END; $$;

-- 3.6: Fetch External Links Securely
CREATE OR REPLACE FUNCTION public.get_external_links_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    title TEXT,
    url TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY 
    SELECT el.id, el.title, el.url, el.is_active, el.created_at
    FROM public.external_links el
    WHERE el.is_active = true
    ORDER BY el.created_at DESC;
END; $$;

-- 3.7: Fetch Group Assistants Securely
CREATE OR REPLACE FUNCTION public.get_group_assistants_secure(p_viewer_id BIGINT, p_schedule_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    assistant_id BIGINT,
    assistant_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT ga.id, ga.assistant_id, u.full_name
        FROM public.group_assistants ga
        JOIN public.users u ON ga.assistant_id = u.id
        WHERE ga.schedule_id = p_schedule_id;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END; $$;

-- 3.8: Fetch Assistant Availability Securely
CREATE OR REPLACE FUNCTION public.get_assistant_availability_secure(p_viewer_id INTEGER, p_day TEXT, p_start TIME, p_end TIME)
RETURNS TABLE (
    user_id INTEGER,
    user_full_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT aa.user_id, u.full_name
        FROM public.assistant_availability aa
        JOIN public.users u ON aa.user_id = u.id
        WHERE aa.day_of_week = p_day
          AND aa.start_time <= p_start
          AND aa.end_time >= p_end;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END; $$;

-- 3.9: Fetch Dashboard Stats Securely
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_secure(p_viewer_id INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_stats JSONB;
    v_phone TEXT;
    v_role TEXT;
BEGIN
    SELECT u.phone_number, u.role INTO v_phone, v_role FROM public.users u WHERE u.id = p_viewer_id;

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

-- 3.10: Fetch Users Securely (Staff Only)
CREATE OR REPLACE FUNCTION public.get_users_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    username TEXT,
    full_name TEXT,
    phone_number TEXT,
    role TEXT,
    nim TEXT,
    assistant_code TEXT,
    division TEXT,
    class_code TEXT,
    shift TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT u.id, u.username, u.full_name, u.phone_number, u.role, u.nim, u.assistant_code, u.division, u.class_code, u.shift, u.is_active, u.created_at
        FROM public.users u
        ORDER BY u.role ASC, u.full_name ASC;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END; $$;

-- 3.11: Fetch Schedule Assignments Securely
CREATE OR REPLACE FUNCTION public.get_schedule_assignments_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    task_role TEXT,
    activity_name TEXT,
    activity_date DATE,
    status TEXT,
    substitute_user_id BIGINT,
    original_user_id BIGINT,
    schedule_id BIGINT,
    schedule_title TEXT,
    schedule_day TEXT,
    schedule_start TIME,
    schedule_end TIME,
    schedule_major TEXT,
    schedule_class_code TEXT,
    user_id BIGINT,
    user_full_name TEXT,
    original_user_full_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY 
    SELECT sa.id, sa.task_role, sa.activity_name, sa.activity_date, sa.status, sa.substitute_user_id, sa.original_user_id,
           s.id as schedule_id, s.title, s.day_of_week, s.start_time, s.end_time, s.major, s.class_code,
           u.id as user_id, u.full_name, u_orig.full_name
    FROM public.schedule_assignments sa
    LEFT JOIN public.schedules s ON sa.schedule_id = s.id
    LEFT JOIN public.users u ON sa.user_id = u.id
    LEFT JOIN public.users u_orig ON sa.original_user_id = u_orig.id
    ORDER BY sa.activity_date ASC;
END; $$;

-- 3.12: Check Menu Access Securely
CREATE OR REPLACE FUNCTION public.check_menu_access_secure(p_viewer_id BIGINT, p_menu_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_division TEXT;
    v_has_access BOOLEAN;
BEGIN
    SELECT u.division INTO v_division FROM public.users u WHERE u.id = p_viewer_id;
    
    IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_viewer_id AND u.role = 'koordinator') THEN
        RETURN TRUE;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.division_access da
        WHERE da.division = v_division AND da.menu_key = p_menu_key
    ) INTO v_has_access;
    
    RETURN v_has_access;
END; $$;

ALTER TABLE public.assistant_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read availability" ON public.assistant_availability;
CREATE POLICY "Public read availability" ON public.assistant_availability FOR SELECT TO anon USING (true);
-- All writes must go through RPC.

-- 5: Cleanup decommissioned tables
DROP TABLE IF EXISTS public.submissions;
