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
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT al.id, al.status, al.notes, al.check_in_time, al.is_verified, al.verification_status, al.reschedule_status, al.reschedule_schedule_id,
               u.id as user_id, u.full_name, u.role, u.username, u.division as major, u.class_code, u.shift, u.phone_number,
               s.title, s.day_of_week, s.start_time
        FROM public.attendance_logs al
        JOIN public.users u ON al.custom_user_id = u.id
        LEFT JOIN public.schedules s ON al.reschedule_schedule_id = s.id
        ORDER BY al.check_in_time DESC;
    ELSE
        RETURN QUERY 
        SELECT al.id, al.status, al.notes, al.check_in_time, al.is_verified, al.verification_status, al.reschedule_status, al.reschedule_schedule_id,
               u.id as user_id, u.full_name, u.role, u.username, u.division as major, u.class_code, u.shift, u.phone_number,
               s.title, s.day_of_week, s.start_time
        FROM public.attendance_logs al
        JOIN public.users u ON al.custom_user_id = u.id
        LEFT JOIN public.schedules s ON al.reschedule_schedule_id = s.id
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
    id UUID,
    nim TEXT,
    completed_lessons INTEGER,
    total_lessons INTEGER,
    completion_percentage DECIMAL,
    is_completed BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_nim TEXT;
BEGIN
    SELECT u.username INTO v_user_nim FROM public.users u WHERE u.id = p_viewer_id;
    
    IF public.is_staff(p_viewer_id) THEN
        RETURN QUERY 
        SELECT ep.id, ep.nim, ep.completed_lessons, ep.total_lessons, ep.completion_percentage, ep.is_completed
        FROM public.elearning_progress ep;
    ELSE
        RETURN QUERY 
        SELECT ep.id, ep.nim, ep.completed_lessons, ep.total_lessons, ep.completion_percentage, ep.is_completed
        FROM public.elearning_progress ep 
        WHERE ep.nim = v_user_nim;
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

-- 3.11: Fetch Schedule Assignments Securely
DROP FUNCTION IF EXISTS public.get_schedule_assignments_secure(INTEGER);
DROP FUNCTION IF EXISTS public.get_schedule_assignments_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_schedule_assignments_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    task_role TEXT,
    activity_name TEXT,
    activity_date DATE,
    status TEXT,
    substitute_user_id BIGINT,
    original_user_id BIGINT,
    schedule_id UUID,
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
        SELECT v_role, s.id, s.title, s.day_of_week, s.start_time, s.end_time, s.major, s.class_code,
               u.id, u.full_name, u.username, u.shift,
               a.id, a.full_name, a.phone_number
        FROM public.group_members gm
        JOIN public.schedules s ON gm.schedule_id = s.id
        JOIN public.users u ON gm.student_id = u.id
        LEFT JOIN public.users a ON gm.assistant_id = a.id
        WHERE gm.student_id = p_viewer_id;
    ELSIF v_role IN ('asisten', 'koordinator', 'sekretaris', 'k3') THEN
        RETURN QUERY
        SELECT v_role, s.id, s.title, s.day_of_week, s.start_time, s.end_time, s.major, s.class_code,
               stu.id, stu.full_name, stu.username, stu.shift,
               asst.id, asst.full_name, asst.phone_number
        FROM public.group_assistants ga
        JOIN public.schedules s ON ga.schedule_id = s.id
        JOIN public.users asst ON ga.assistant_id = asst.id
        LEFT JOIN public.group_members gm ON ga.schedule_id = gm.schedule_id AND ga.assistant_id = gm.assistant_id
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
