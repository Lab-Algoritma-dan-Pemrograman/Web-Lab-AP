-- =====================================================
-- Migration: Zero-Leak Hardening (Strict RLS + Secure RPCs)
-- Date: 2026-04-16
-- =====================================================

-- ==========================================
-- STEP 1: HELPER FUNCTIONS (RE-VERIFY)
-- ==========================================

DROP FUNCTION IF EXISTS public.is_admin(INTEGER);
DROP FUNCTION IF EXISTS public.is_admin(BIGINT);
-- Ensure is_admin and is_staff exist and are secure
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role = 'koordinator' AND is_active = true);
END; $$;

DROP FUNCTION IF EXISTS public.is_staff(INTEGER);
DROP FUNCTION IF EXISTS public.is_staff(BIGINT);
CREATE OR REPLACE FUNCTION public.is_staff(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role IN ('asisten', 'koordinator', 'sekretaris', 'k3') AND is_active = true);
END; $$;

-- Helper to check if someone is PJ Absen today
CREATE OR REPLACE FUNCTION public.is_pj_absen_today(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.schedule_assignments 
        WHERE user_id = p_user_id 
        AND task_role = 'PJ Absen' 
        AND activity_date = CURRENT_DATE 
        AND status = 'aktif'
    );
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

-- Restore basic access for authenticated users to avoid empty pages
DO $$ 
DECLARE 
    t TEXT;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated select" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Allow authenticated select" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    END LOOP;
END $$;

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
DROP FUNCTION IF EXISTS public.get_attendance_logs_secure(INTEGER);
DROP FUNCTION IF EXISTS public.get_attendance_logs_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_attendance_logs_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    status TEXT,
    notes TEXT,
    check_in_time TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN,
    verification_status TEXT,
    reschedule_status TEXT,
    reschedule_schedule_id TEXT,
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
        SELECT al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time, al.is_verified, al.verification_status, al.reschedule_status, al.reschedule_schedule_id::TEXT,
               u.id as user_id, u.full_name as user_full_name, u.role as user_role, u.username as user_username, u.division as user_major, u.class_code as user_class_code, u.shift as user_shift, u.phone_number as user_phone_number,
               s.title as schedule_title, s.day_of_week as schedule_day, s.start_time as schedule_time
        FROM public.attendance_logs al
        JOIN public.users u ON al.custom_user_id = u.id
        LEFT JOIN public.schedules s ON al.reschedule_schedule_id::TEXT = s.id::TEXT
        ORDER BY al.check_in_time DESC;
    ELSE
        RETURN QUERY 
        SELECT al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time, al.is_verified, al.verification_status, al.reschedule_status, al.reschedule_schedule_id::TEXT,
               u.id as user_id, u.full_name as user_full_name, u.role as user_role, u.username as user_username, u.division as user_major, u.class_code as user_class_code, u.shift as user_shift, u.phone_number as user_phone_number,
               s.title as schedule_title, s.day_of_week as schedule_day, s.start_time as schedule_time
        FROM public.attendance_logs al
        JOIN public.users u ON al.custom_user_id = u.id
        LEFT JOIN public.schedules s ON al.reschedule_schedule_id::TEXT = s.id::TEXT
        WHERE al.custom_user_id = p_viewer_id
        ORDER BY al.check_in_time DESC;
    END IF;
END; $$;

-- 3.1.b: Check already absent today
CREATE OR REPLACE FUNCTION public.check_already_absent_secure(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.attendance_logs 
        WHERE custom_user_id = p_user_id 
        AND check_in_time >= CURRENT_DATE 
        AND check_in_time < CURRENT_DATE + 1
    );
END; $$;

-- 3.2: Fetch Feedback Securely
DROP FUNCTION IF EXISTS public.get_feedback_secure(INTEGER);
DROP FUNCTION IF EXISTS public.get_feedback_secure(BIGINT);
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
DROP FUNCTION IF EXISTS public.get_financial_records_secure(INTEGER);
DROP FUNCTION IF EXISTS public.get_financial_records_secure(BIGINT);
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
DROP FUNCTION IF EXISTS public.get_group_members_secure(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS public.get_group_members_secure(BIGINT, UUID);
CREATE OR REPLACE FUNCTION public.get_group_members_secure(p_viewer_id BIGINT, p_schedule_id UUID DEFAULT NULL)
RETURNS TABLE (
    id BIGINT,
    schedule_id UUID,
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
DROP FUNCTION IF EXISTS public.get_elearning_progress_secure(INTEGER);
DROP FUNCTION IF EXISTS public.get_elearning_progress_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_elearning_progress_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id TEXT,
    nim TEXT,
    student_name TEXT,
    completed_lessons INTEGER,
    total_lessons INTEGER,
    completion_percentage DECIMAL,
    is_completed BOOLEAN,
    completed_levels JSONB,
    current_level TEXT,
    last_accessed_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_nim TEXT;
    v_user_username TEXT;
BEGIN
    SELECT u.nim, u.username INTO v_user_nim, v_user_username FROM public.users u WHERE u.id = p_viewer_id;
    
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT 
            ep.id::TEXT, ep.nim, COALESCE(ep.student_name, u.full_name) as student_name, 
            COALESCE(NULLIF(ep.lessons_completed, 0), ep.completed_lessons) as completed_lessons,
            ep.total_lessons, 
            ep.completion_percentage::DECIMAL, 
            ep.is_completed, ep.completed_levels, ep.current_level, ep.last_accessed_at
        FROM public.elearning_progress ep
        LEFT JOIN public.users u ON (ep.nim = u.nim OR ep.nim = u.username)
        ORDER BY ep.last_accessed_at DESC NULLS LAST;
    ELSE
        RETURN QUERY 
        SELECT 
            ep.id::TEXT, ep.nim, COALESCE(ep.student_name, u.full_name) as student_name, 
            COALESCE(NULLIF(ep.lessons_completed, 0), ep.completed_lessons) as completed_lessons,
            ep.total_lessons, 
            ep.completion_percentage::DECIMAL, 
            ep.is_completed, ep.completed_levels, ep.current_level, ep.last_accessed_at
        FROM public.elearning_progress ep 
        LEFT JOIN public.users u ON (ep.nim = u.nim OR ep.nim = u.username)
        WHERE ep.nim = v_user_nim OR ep.nim = v_user_username;
    END IF;
END; $$;

-- 3.6: Fetch External Links Securely
DROP FUNCTION IF EXISTS public.get_external_links_secure(INTEGER);
DROP FUNCTION IF EXISTS public.get_external_links_secure(BIGINT);
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

-- 3.6.b: Fetch QR Session Securely (For Scan)
DROP FUNCTION IF EXISTS public.get_qr_session_secure(TEXT);
CREATE OR REPLACE FUNCTION public.get_qr_session_secure(p_token TEXT)
RETURNS TABLE (
    id UUID,
    title TEXT,
    is_active BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY 
    SELECT qs.id, qs.title, qs.is_active
    FROM public.qr_sessions qs
    WHERE qs.token = p_token AND qs.is_active = true
    LIMIT 1;
END; $$;

-- 3.7: Fetch Group Assistants Securely
DROP FUNCTION IF EXISTS public.get_group_assistants_secure(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS public.get_group_assistants_secure(BIGINT, UUID);
CREATE OR REPLACE FUNCTION public.get_group_assistants_secure(p_viewer_id BIGINT, p_schedule_id UUID)
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
DROP FUNCTION IF EXISTS public.get_assistant_availability_secure(INTEGER, TEXT, TIME, TIME);
DROP FUNCTION IF EXISTS public.get_assistant_availability_secure(BIGINT, TEXT, TIME, TIME);
CREATE OR REPLACE FUNCTION public.get_assistant_availability_secure(p_viewer_id BIGINT, p_day TEXT, p_start TIME, p_end TIME)
RETURNS TABLE (
    user_id BIGINT,
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

-- 3.8.b: Fetch ALL Availability for a specific user
DROP FUNCTION IF EXISTS public.get_all_availability_for_user_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.get_all_availability_for_user_secure(p_viewer_id BIGINT, p_target_user_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    day_of_week TEXT,
    start_time TIME,
    end_time TIME
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Allow viewing self or if viewer is staff
    IF p_viewer_id = p_target_user_id OR public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT aa.id, aa.day_of_week, aa.start_time, aa.end_time
        FROM public.assistant_availability aa
        WHERE aa.user_id = p_target_user_id;
    ELSE
        RAISE EXCEPTION 'Unauthorized';
    END IF;
END; $$;

-- 3.9: Fetch Dashboard Stats Securely
DROP FUNCTION IF EXISTS public.get_dashboard_stats_secure(INTEGER);
DROP FUNCTION IF EXISTS public.get_dashboard_stats_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_secure(p_viewer_id BIGINT)
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
DROP FUNCTION IF EXISTS public.get_users_secure(INTEGER);
DROP FUNCTION IF EXISTS public.get_users_secure(BIGINT);
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

-- 3.12: Check Menu Access Securely
DROP FUNCTION IF EXISTS public.check_menu_access_secure(INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.check_menu_access_secure(BIGINT, TEXT);
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

-- 4.0: Fetch User Profile Securely
DROP FUNCTION IF EXISTS public.get_user_profile(INTEGER);
DROP FUNCTION IF EXISTS public.get_user_profile(BIGINT);
CREATE OR REPLACE FUNCTION public.get_user_profile(p_target_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    username TEXT,
    full_name TEXT,
    role TEXT,
    nim TEXT,
    assistant_code TEXT,
    division TEXT,
    is_active BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY 
    SELECT u.id, u.username, u.full_name, u.role, u.nim, u.assistant_code, u.division, u.is_active
    FROM public.users u
    WHERE u.id = p_target_id;
END; $$;

-- 4.1: Administrative Update User
DROP FUNCTION IF EXISTS public.admin_update_user(INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT);
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
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

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
END; $$;

-- 4.2: Administrative Delete User
DROP FUNCTION IF EXISTS public.admin_delete_user(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.admin_delete_user(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.admin_delete_user(
    p_caller_id BIGINT,
    p_target_id BIGINT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    DELETE FROM public.attendance_logs     WHERE custom_user_id = p_target_id;
    DELETE FROM public.feedback            WHERE custom_user_id = p_target_id;
    DELETE FROM public.group_members       WHERE student_id = p_target_id OR assistant_id = p_target_id;
    DELETE FROM public.group_assistants    WHERE assistant_id = p_target_id;
    DELETE FROM public.schedule_assignments WHERE user_id = p_target_id;
    DELETE FROM public.assistant_availability WHERE user_id = p_target_id;
    DELETE FROM public.elearning_progress  WHERE nim = (SELECT username FROM public.users WHERE id = p_target_id);
    DELETE FROM public.users WHERE id = p_target_id;
END; $$;

-- 4.3: Administrative Toggle User Status
DROP FUNCTION IF EXISTS public.admin_toggle_user_status(INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_toggle_user_status(BIGINT, BIGINT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.admin_toggle_user_status(
    p_caller_id BIGINT,
    p_target_id BIGINT,
    p_is_active BOOLEAN
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    UPDATE public.users SET is_active = p_is_active WHERE id = p_target_id;
END; $$;

-- 4.4: Administrative Verify Attendance (License/Reschedule)
CREATE OR REPLACE FUNCTION public.admin_verify_attendance_secure(
    p_caller_id BIGINT,
    p_log_id BIGINT,
    p_is_approved BOOLEAN,
    p_type TEXT -- 'license' or 'reschedule'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_type = 'license' THEN
        UPDATE public.attendance_logs SET
            verification_status = CASE WHEN p_is_approved THEN 'approved' ELSE 'rejected' END,
            is_verified = p_is_approved
        WHERE id = p_log_id;
    ELSIF p_type = 'reschedule' THEN
        UPDATE public.attendance_logs SET
            reschedule_status = CASE WHEN p_is_approved THEN 'approved' ELSE 'rejected' END,
            reschedule_schedule_id = CASE WHEN p_is_approved THEN reschedule_schedule_id ELSE NULL END
        WHERE id = p_log_id;
    END IF;
END; $$;

-- 4.5: Financial Management Secure
CREATE OR REPLACE FUNCTION public.upsert_financial_record_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_title TEXT,
    p_amount DECIMAL,
    p_type TEXT,
    p_category TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_id = 0 OR p_id IS NULL THEN
        INSERT INTO public.financial_records (title, amount, type, category, date)
        VALUES (p_title, p_amount, p_type, p_category, CURRENT_DATE);
    ELSE
        UPDATE public.financial_records SET
            title = p_title,
            amount = p_amount,
            type = p_type,
            category = p_category
        WHERE id = p_id;
    END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_financial_record_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    DELETE FROM public.financial_records WHERE id = p_id;
END; $$;

-- 5.0: Equipment Management
DROP FUNCTION IF EXISTS public.get_equipment_secure();
CREATE OR REPLACE FUNCTION public.get_equipment_secure()
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    type TEXT,
    description TEXT,
    file_url TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT e.id, e.name, e.type, e.description, e.file_url, e.uploaded_at FROM public.equipment e ORDER BY e.uploaded_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_equipment_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_name TEXT,
    p_type TEXT,
    p_description TEXT,
    p_file_url TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Check if admin or has division access (simplified to is_staff for now)
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_id = 0 OR p_id IS NULL THEN
        INSERT INTO public.equipment (name, type, description, file_url)
        VALUES (p_name, p_type, p_description, p_file_url);
    ELSE
        UPDATE public.equipment SET
            name = p_name,
            type = p_type,
            description = p_description,
            file_url = p_file_url
        WHERE id = p_id;
    END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_equipment_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    DELETE FROM public.equipment WHERE id = p_id;
END; $$;

-- 6.0: Assistant Availability Management
CREATE OR REPLACE FUNCTION public.save_assistant_availability_secure(
    p_caller_id BIGINT,
    p_target_user_id BIGINT,
    p_id BIGINT,
    p_day TEXT,
    p_start TIME,
    p_end TIME
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Allow self-update or is_admin (coordinator)
    IF p_caller_id != p_target_user_id AND NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_id = 0 OR p_id IS NULL THEN
        INSERT INTO public.assistant_availability (user_id, day_of_week, start_time, end_time)
        VALUES (p_target_user_id, p_day, p_start, p_end);
    ELSE
        UPDATE public.assistant_availability SET
            day_of_week = p_day,
            start_time = p_start,
            end_time = p_end
        WHERE id = p_id AND user_id = p_target_user_id;
    END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_assistant_availability_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    -- Note: We allow any staff to delete availability for now, 
    -- but usually it's own or coordinator.
    DELETE FROM public.assistant_availability WHERE id = p_id;
END; $$;

-- 7.0: Complex Attendance Operations
CREATE OR REPLACE FUNCTION public.upsert_attendance_log_secure(
    p_caller_id BIGINT,
    p_target_user_id BIGINT,
    p_status TEXT,
    p_notes TEXT,
    p_check_in TIMESTAMP WITH TIME ZONE,
    p_is_verified BOOLEAN,
    p_type TEXT, -- 'scan', 'izin', 'staff_manual', 'reschedule'
    p_schedule_id UUID DEFAULT NULL,
    p_session_id UUID DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Permissions check
    IF p_type = 'scan' OR p_type = 'izin' THEN
        IF p_caller_id != p_target_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    ELSIF p_type = 'staff_manual' THEN
        IF NOT (public.is_staff(p_caller_id) OR public.is_pj_absen_today(p_caller_id)) THEN
            RAISE EXCEPTION 'Unauthorized staff access';
        END IF;
    ELSIF p_type = 'reschedule' THEN
        IF p_caller_id != p_target_user_id THEN RAISE EXCEPTION 'Unauthorized reschedule'; END IF;
    END IF;

    IF p_type = 'reschedule' THEN
        UPDATE public.attendance_logs 
        SET reschedule_schedule_id = p_schedule_id, reschedule_status = 'pending'
        WHERE custom_user_id = p_target_user_id AND id = CAST(p_notes AS BIGINT); -- In reschedule, notes usually carries target log ID
    ELSE
        INSERT INTO public.attendance_logs (custom_user_id, status, notes, check_in_time, is_verified, session_id)
        VALUES (p_target_user_id, p_status, p_notes, p_check_in, p_is_verified, p_session_id);
    END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_attendance_log_secure(
    p_caller_id BIGINT,
    p_log_id BIGINT,
    p_reason TEXT,
    p_target_nim TEXT,
    p_snapshot_data TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT (public.is_staff(p_caller_id) OR public.is_pj_absen_today(p_caller_id)) THEN
        RAISE EXCEPTION 'Unauthorized deletion';
    END IF;

    INSERT INTO public.attendance_deletion_history (deleted_by, target_user_id, snapshot_data, reason)
    VALUES (p_caller_id, p_target_nim, p_snapshot_data, p_reason);

    DELETE FROM public.attendance_logs WHERE id = p_log_id;
END; $$;

-- Deletion History
DROP FUNCTION IF EXISTS public.get_deletion_history_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_deletion_history_secure(p_caller_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    deleted_by_name TEXT,
    target_user_id TEXT,
    reason TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY 
    SELECT h.id, u.full_name, h.target_user_id, h.reason, h.deleted_at
    FROM public.attendance_deletion_history h
    JOIN public.users u ON h.deleted_by = u.id
    ORDER BY h.deleted_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.get_assistant_contact_secure(p_caller_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_phone TEXT;
BEGIN
    -- This is a helper for praktikan to find an active assistant contact
    -- Try division with access first, then koor
    SELECT u.phone_number INTO v_phone
    FROM public.users u
    JOIN public.division_access da ON u.division = da.division
    WHERE da.menu_key = '/validasi-absensi' AND u.role = 'asisten' AND u.phone_number IS NOT NULL
    LIMIT 1;

    IF v_phone IS NULL THEN
        SELECT u.phone_number INTO v_phone FROM public.users u WHERE u.role = 'koordinator' AND u.phone_number IS NOT NULL LIMIT 1;
    END IF;

    RETURN v_phone;
END; $$;

-- 8.0: Personal Schedule Management (Including Shift)
DROP FUNCTION IF EXISTS public.get_personal_schedules_secure(INTEGER);
DROP FUNCTION IF EXISTS public.get_personal_schedules_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_personal_schedules_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    role TEXT,
    schedule_id TEXT,
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
        SELECT v_role as role, s.id::TEXT as schedule_id, s.title as schedule_title, s.day_of_week as schedule_day, s.start_time as schedule_start, s.end_time as schedule_end, s.major as schedule_major, s.class_code as schedule_class,
               u.id::BIGINT as student_id, u.full_name as student_name, u.username as student_nim, u.shift as student_shift,
               a.id::BIGINT as assistant_id, a.full_name as assistant_name, a.phone_number as assistant_phone
        FROM public.group_members gm
        JOIN public.schedules s ON gm.schedule_id::TEXT = s.id::TEXT
        JOIN public.users u ON gm.student_id = u.id
        LEFT JOIN public.users a ON gm.assistant_id = a.id
        WHERE gm.student_id = p_viewer_id;
    ELSIF v_role IN ('asisten', 'koordinator', 'sekretaris', 'k3') THEN
        RETURN QUERY
        SELECT v_role as role, s.id::TEXT as schedule_id, s.title as schedule_title, s.day_of_week as schedule_day, s.start_time as schedule_start, s.end_time as schedule_end, s.major as schedule_major, s.class_code as schedule_class,
               stu.id::BIGINT as student_id, stu.full_name as student_name, stu.username as student_nim, stu.shift as student_shift,
               asst.id::BIGINT as assistant_id, asst.full_name as assistant_name, asst.phone_number as assistant_phone
        FROM public.group_assistants ga
        JOIN public.schedules s ON ga.schedule_id::TEXT = s.id::TEXT
        JOIN public.users asst ON ga.assistant_id = asst.id
        LEFT JOIN public.group_members gm ON ga.schedule_id::TEXT = gm.schedule_id::TEXT AND ga.assistant_id = gm.assistant_id
        LEFT JOIN public.users stu ON gm.student_id = stu.id
        WHERE ga.assistant_id = p_viewer_id;
    END IF;
END; $$;

ALTER TABLE public.assistant_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read availability" ON public.assistant_availability;
CREATE POLICY "Public read availability" ON public.assistant_availability FOR SELECT TO anon USING (true);
-- All writes must go through RPC.

-- 5: Cleanup decommissioned tables
DROP TABLE IF EXISTS public.submissions;

-- 9.0: Jadwal Jaga Secure Management
DROP FUNCTION IF EXISTS public.get_schedule_assignments_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_schedule_assignments_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    schedule_id UUID,
    schedule_title TEXT,
    schedule_day TEXT,
    schedule_start TIME,
    schedule_end TIME,
    schedule_major TEXT,
    schedule_class_code TEXT,
    user_id BIGINT,
    user_full_name TEXT,
    original_user_id BIGINT,
    original_user_full_name TEXT,
    substitute_user_id BIGINT,
    task_role TEXT,
    activity_name TEXT,
    activity_date DATE,
    status TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT sa.id::BIGINT as id, sa.schedule_id as schedule_id, s.title as schedule_title, s.day_of_week as schedule_day, s.start_time as schedule_start, s.end_time as schedule_end, s.major as schedule_major, s.class_code as schedule_class_code,
           u.id::BIGINT as user_id, u.full_name as user_full_name, ou.id::BIGINT as original_user_id, ou.full_name as original_user_full_name, sa.substitute_user_id::BIGINT as substitute_user_id,
           sa.task_role, sa.activity_name, sa.activity_date, sa.status
    FROM public.schedule_assignments sa
    JOIN public.schedules s ON sa.schedule_id = s.id
    LEFT JOIN public.users u ON sa.user_id = u.id
    LEFT JOIN public.users ou ON sa.original_user_id = ou.id
    ORDER BY sa.activity_date DESC, s.start_time ASC;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_schedule_assignment_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_schedule_id UUID,
    p_user_id BIGINT,
    p_task_role TEXT,
    p_activity_name TEXT,
    p_activity_date DATE
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    IF p_id IS NULL OR p_id = 0 THEN
        INSERT INTO public.schedule_assignments (schedule_id, user_id, task_role, activity_name, activity_date, status)
        VALUES (p_schedule_id, p_user_id, p_task_role, p_activity_name, p_activity_date, 'aktif');
    ELSE
        UPDATE public.schedule_assignments SET
            schedule_id = p_schedule_id,
            user_id = p_user_id,
            task_role = p_task_role,
            activity_name = p_activity_name,
            activity_date = p_activity_date
        WHERE id = p_id;
    END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_schedule_assignment_secure(
    p_caller_id BIGINT,
    p_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;
    DELETE FROM public.schedule_assignments WHERE id = p_id;
END; $$;

-- 10.0: Manajemen Kelas / Plotting Secure
DROP FUNCTION IF EXISTS public.get_schedules_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_schedules_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id UUID,
    title TEXT,
    major TEXT,
    class_code TEXT,
    day_of_week TEXT,
    start_time TIME,
    end_time TIME,
    type TEXT,
    status TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT s.id, s.title, s.major, s.class_code, s.day_of_week, s.start_time, s.end_time, s.type, s.status
    FROM public.schedules s;
END; $$;

CREATE OR REPLACE FUNCTION public.sync_students_to_group_secure(
    p_caller_id BIGINT,
    p_schedule_id UUID,
    p_major TEXT,
    p_class_code TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    INSERT INTO public.group_members (schedule_id, student_id)
    SELECT p_schedule_id, u.id
    FROM public.users u
    WHERE u.role = 'praktikan' AND u.division = p_major AND u.class_code = p_class_code
    ON CONFLICT (schedule_id, student_id) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.update_group_members_batch_secure(
    p_caller_id BIGINT,
    p_updates JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_item RECORD;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_updates) AS x(id BIGINT, assistant_id BIGINT)
    LOOP
        UPDATE public.group_members SET assistant_id = v_item.assistant_id WHERE id = v_item.id;
    END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.reset_group_plotting_secure(
    p_caller_id BIGINT,
    p_schedule_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;
    UPDATE public.group_members SET assistant_id = NULL WHERE schedule_id = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_group_assistant_secure(
    p_caller_id BIGINT,
    p_schedule_id UUID,
    p_assistant_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;
    INSERT INTO public.group_assistants (schedule_id, assistant_id)
    VALUES (p_schedule_id, p_assistant_id)
    ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_group_assistant_secure(
    p_caller_id BIGINT,
    p_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;
    DELETE FROM public.group_assistants WHERE id = p_id;
END; $$;

-- 11.0: Bulk Data Operations
DROP FUNCTION IF EXISTS public.get_all_group_members_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_all_group_members_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    schedule_class_code TEXT,
    schedule_major TEXT,
    schedule_title TEXT,
    schedule_day TEXT,
    schedule_start TIME,
    schedule_end TIME,
    assistant_name TEXT,
    student_name TEXT,
    student_nim TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    RETURN QUERY
    SELECT gm.id, s.class_code, s.major, s.title, s.day_of_week, s.start_time, s.end_time,
           u_a.full_name, u_s.full_name, u_s.username
    FROM public.group_members gm
    JOIN public.schedules s ON gm.schedule_id = s.id
    JOIN public.users u_s ON gm.student_id = u_s.id
    LEFT JOIN public.users u_a ON gm.assistant_id = u_a.id;
END; $$;
-- 3.12: Fetch External Links Securely
DROP FUNCTION IF EXISTS public.get_external_links_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_external_links_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    title TEXT,
    url TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT el.id, el.title, el.url, el.is_active, el.created_at FROM public.external_links el ORDER BY el.created_at DESC;
END;
$$;

-- 3.13: Fetch Inventory Items Securely
DROP FUNCTION IF EXISTS public.get_inventory_items_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_inventory_items_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    condition TEXT,
    quantity INTEGER,
    location TEXT,
    created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT ii.id, ii.name, ii.condition, ii.quantity, ii.location, ii.created_at FROM public.inventory_items ii ORDER BY ii.name ASC;
END;
$$;

-- 3.14: Fetch System Settings Securely
DROP FUNCTION IF EXISTS public.get_system_settings_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_system_settings_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    active_shift TEXT,
    updated_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT ss.active_shift, ss.updated_at FROM public.system_settings ss LIMIT 1;
END;
$$;

-- ==========================================
-- SECTION 4: Data Management (Write Ops)
-- ==========================================

-- 4.1: Upsert Schedule Secure (Admin Only)
CREATE OR REPLACE FUNCTION public.upsert_schedule_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_day_of_week TEXT,
    p_start_time TIME,
    p_end_time TIME,
    p_title TEXT,
    p_major TEXT,
    p_class_code TEXT,
    p_type TEXT DEFAULT 'praktikum',
    p_status TEXT DEFAULT 'approved'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat mengelola jadwal.';
    END IF;

    IF p_id IS NULL OR p_id = 0 THEN
        INSERT INTO public.schedules (day_of_week, start_time, end_time, title, major, class_code, type, status)
        VALUES (p_day_of_week, p_start_time, p_end_time, p_title, p_major, p_class_code, p_type, p_status);
    ELSE
        UPDATE public.schedules SET
            day_of_week = p_day_of_week, start_time = p_start_time, end_time = p_end_time,
            title = p_title, major = p_major, class_code = p_class_code, type = p_type,
            status = p_status, updated_at = NOW()
        WHERE id = p_id;
    END IF;
END;
$$;

-- 4.2: Delete Schedule Secure (Admin Only)
CREATE OR REPLACE FUNCTION public.delete_schedule_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya koordinator yang dapat menghapus jadwal.';
    END IF;
    DELETE FROM public.schedules WHERE id = p_id;
END;
$$;

-- 4.3: Upsert Inventory Item Secure (Staff Only)
CREATE OR REPLACE FUNCTION public.upsert_inventory_item_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_name TEXT,
    p_condition TEXT,
    p_quantity INTEGER,
    p_location TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat mengelola inventaris.';
    END IF;

    IF p_id IS NULL OR p_id = 0 THEN
        INSERT INTO public.inventory_items (name, condition, quantity, location)
        VALUES (p_name, p_condition, p_quantity, p_location);
    ELSE
        UPDATE public.inventory_items SET
            name = p_name, condition = p_condition, quantity = p_quantity, 
            location = p_location, updated_at = NOW()
        WHERE id = p_id;
    END IF;
END;
$$;

-- 4.4: Delete Inventory Item Secure (Staff Only)
CREATE OR REPLACE FUNCTION public.delete_inventory_item_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat menghapus inventaris.';
    END IF;
    DELETE FROM public.inventory_items WHERE id = p_id;
END;
$$;

-- 4.5: Insert Feedback Secure
CREATE OR REPLACE FUNCTION public.insert_feedback_secure(
    p_caller_id BIGINT,
    p_category TEXT,
    p_content TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.feedback (custom_user_id, category, content)
    VALUES (p_caller_id, p_category, p_content);
END;
$$;

-- 4.6: Upsert External Link Secure (Staff Only)
CREATE OR REPLACE FUNCTION public.upsert_external_link_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_title TEXT,
    p_url TEXT,
    p_is_active BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat mengelola tautan.';
    END IF;

    IF p_id IS NULL OR p_id = 0 THEN
        INSERT INTO public.external_links (title, url, is_active)
        VALUES (p_title, p_url, p_is_active);
    ELSE
        UPDATE public.external_links SET
            title = p_title, url = p_url, is_active = p_is_active
        WHERE id = p_id;
    END IF;
END;
$$;

-- 4.7: Delete External Link Secure (Staff Only)
CREATE OR REPLACE FUNCTION public.delete_external_link_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat menghapus tautan.';
    END IF;
    DELETE FROM public.external_links WHERE id = p_id;
END;
$$;

-- 4.8: Upsert QR Session Secure (Staff Only)
DROP FUNCTION IF EXISTS public.upsert_qr_session_secure(BIGINT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.upsert_qr_session_secure(
    p_caller_id BIGINT,
    p_title TEXT,
    p_token TEXT
) RETURNS TABLE (id BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_new_id BIGINT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat membuat sesi QR.';
    END IF;

    INSERT INTO public.qr_sessions (title, token, created_by, is_active)
    VALUES (p_title, p_token, p_caller_id, TRUE)
    RETURNING public.qr_sessions.id INTO v_new_id;
    
    RETURN QUERY SELECT v_new_id;
END;
$$;

-- 4.9: Update QR Session Token (Staff Only)
CREATE OR REPLACE FUNCTION public.update_qr_session_token_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_token TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;
    UPDATE public.qr_sessions SET token = p_token WHERE id = p_id;
END;
$$;

-- 4.10: Stop QR Session (Staff Only)
CREATE OR REPLACE FUNCTION public.stop_qr_session_secure(
    p_caller_id BIGINT,
    p_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;
    UPDATE public.qr_sessions SET is_active = FALSE WHERE id = p_id;
END;
$$;

-- 4.11: Update Swap Status Secure (Assistant Only)
CREATE OR REPLACE FUNCTION public.update_swap_status_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_status TEXT,
    p_substitute_id BIGINT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Hanya asisten yang bersangkutan atau staff yang bisa ubah status
    IF NOT (public.is_staff(p_caller_id) OR EXISTS (SELECT 1 FROM public.schedule_assignments sa WHERE sa.id = p_id AND sa.user_id = p_caller_id)) THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    UPDATE public.schedule_assignments SET 
        status = p_status, 
        substitute_user_id = p_substitute_id 
    WHERE id = p_id;
END;
$$;

-- 4.12: Approve Swap Secure (Admin Only)
CREATE OR REPLACE FUNCTION public.approve_swap_secure(
    p_caller_id BIGINT,
    p_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_sub_id BIGINT;
    v_orig_id BIGINT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat menyetujui swap.';
    END IF;

    SELECT user_id, substitute_user_id INTO v_orig_id, v_sub_id
    FROM public.schedule_assignments WHERE id = p_id;

    IF v_sub_id IS NULL THEN
        RAISE EXCEPTION 'Tidak ada pengunganti yang terdaftar.';
    END IF;

    UPDATE public.schedule_assignments SET 
        user_id = v_sub_id, 
        original_user_id = v_orig_id, 
        substitute_user_id = NULL, 
        status = 'aktif' 
    WHERE id = p_id;
END;
$$;

-- 4.13: Refined Admin Save Division Access
CREATE OR REPLACE FUNCTION public.admin_save_division_access(
    p_caller_id BIGINT,
    p_division TEXT,
    p_menu_keys TEXT[]
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya koordinator yang dapat mengelola hak akses.';
    END IF;

    -- Hapus akses lama
    DELETE FROM public.division_access WHERE division = p_division;

    -- Insert akses baru
    IF p_menu_keys IS NOT NULL AND array_length(p_menu_keys, 1) > 0 THEN
        INSERT INTO public.division_access (division, menu_key)
        SELECT p_division, unnest(p_menu_keys);
    END IF;
END;
$$;

-- 4.14: Admin Update System Setting
CREATE OR REPLACE FUNCTION public.admin_update_system_setting(
    p_caller_id BIGINT,
    p_active_shift TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    UPDATE public.system_settings SET active_shift = p_active_shift, updated_at = NOW();
    
    -- Jika tidak ada record, insert
    IF NOT FOUND THEN
        INSERT INTO public.system_settings (active_shift) VALUES (p_active_shift);
    END IF;
END;
$$;

-- 4.15: Get Division Access Secure (Staff Only)
DROP FUNCTION IF EXISTS public.get_division_access_secure(BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.get_division_access_secure(
    p_viewer_id BIGINT,
    p_division TEXT
) RETURNS TABLE (menu_key TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;
    RETURN QUERY SELECT da.menu_key FROM public.division_access da WHERE da.division = p_division;
END;
$$;

-- 4.16: Get System Settings Full Secure
DROP FUNCTION IF EXISTS public.get_system_settings_full_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_system_settings_full_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    semester_active TEXT,
    announcement TEXT,
    is_recruitment_open BOOLEAN,
    active_shift TEXT,
    updated_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT ss.id, ss.semester_active, ss.announcement, ss.is_recruitment_open, ss.active_shift, ss.updated_at FROM public.system_settings ss LIMIT 1;
END;
$$;

-- 4.17: Update Global System Settings (Admin Only)
CREATE OR REPLACE FUNCTION public.admin_update_global_settings_secure(
    p_caller_id BIGINT,
    p_semester_active TEXT,
    p_announcement TEXT,
    p_is_recruitment_open BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    UPDATE public.system_settings SET 
        semester_active = p_semester_active,
        announcement = p_announcement,
        is_recruitment_open = p_is_recruitment_open,
        updated_at = NOW();
    
    IF NOT FOUND THEN
        INSERT INTO public.system_settings (semester_active, announcement, is_recruitment_open) 
        VALUES (p_semester_active, p_announcement, p_is_recruitment_open);
    END IF;
END;
$$;

-- 4.18: Get Public Settings (No Auth Required)
DROP FUNCTION IF EXISTS public.get_public_settings();
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE (
    announcement TEXT,
    is_recruitment_open BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT ss.announcement, ss.is_recruitment_open FROM public.system_settings ss LIMIT 1;
END;
$$;

-- 4.19: Update User Profile Secure (Self Only)
CREATE OR REPLACE FUNCTION public.update_user_profile_secure(
    p_caller_id BIGINT,
    p_phone_number TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.users SET phone_number = p_phone_number WHERE id = p_caller_id;
END;
$$;
