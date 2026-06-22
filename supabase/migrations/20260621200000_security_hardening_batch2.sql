-- =====================================================
-- Migration: SECURITY HARDENING & AUDIT LOGGING BATCH 2 & 3 (20260621200000)
-- Purpose: Set search_path to public on security definer functions, add audit logs
--          to remaining write ops, enforce caller verification on read ops, and lock down attendance logs RLS.
-- =====================================================

-- =====================================================
-- 1. WRITE OPERATIONS (Add SET search_path & log_activity)
-- =====================================================

-- 1.1 upsert_schedule_secure
DROP FUNCTION IF EXISTS public.upsert_schedule_secure(BIGINT, BIGINT, TEXT, TIME, TIME, TEXT, TEXT, TEXT, TEXT, TEXT);
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
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_action TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat mengelola jadwal.';
    END IF;

    IF p_id IS NULL OR p_id = 0 THEN
        INSERT INTO public.schedules (day_of_week, start_time, end_time, title, major, class_code, type, status)
        VALUES (p_day_of_week, p_start_time, p_end_time, p_title, p_major, p_class_code, p_type, p_status);
        v_action := 'Membuat jadwal baru: ' || p_title || ' (' || p_class_code || ')';
    ELSE
        UPDATE public.schedules SET
            day_of_week = p_day_of_week, start_time = p_start_time, end_time = p_end_time,
            title = p_title, major = p_major, class_code = p_class_code, type = p_type,
            status = p_status, updated_at = NOW()
        WHERE id = p_id;
        v_action := 'Mengubah jadwal ID ' || p_id::TEXT || ': ' || p_title;
    END IF;

    PERFORM public.log_activity(
        p_caller_id, 
        'SCHEDULE_MANAGEMENT', 
        v_action, 
        jsonb_build_object('day_of_week', p_day_of_week, 'title', p_title, 'class_code', p_class_code)
    );
END; $$;


-- 1.2 upsert_inventory_item_secure
DROP FUNCTION IF EXISTS public.upsert_inventory_item_secure(BIGINT, BIGINT, TEXT, TEXT, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION public.upsert_inventory_item_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_name TEXT,
    p_condition TEXT,
    p_quantity INTEGER,
    p_location TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_action TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat mengelola inventaris.';
    END IF;

    IF p_id IS NULL OR p_id = 0 THEN
        INSERT INTO public.inventory_items (name, condition, quantity, location)
        VALUES (p_name, p_condition, p_quantity, p_location);
        v_action := 'Menambah barang inventaris baru: ' || p_name || ' (' || p_quantity::TEXT || ' unit)';
    ELSE
        UPDATE public.inventory_items SET
            name = p_name, condition = p_condition, quantity = p_quantity, 
            location = p_location, updated_at = NOW()
        WHERE id = p_id;
        v_action := 'Mengubah data barang inventaris ID ' || p_id::TEXT || ': ' || p_name;
    END IF;

    PERFORM public.log_activity(
        p_caller_id, 
        'INVENTORY_MANAGEMENT', 
        v_action, 
        jsonb_build_object('name', p_name, 'condition', p_condition, 'quantity', p_quantity)
    );
END; $$;


-- 1.3 delete_inventory_item_secure
DROP FUNCTION IF EXISTS public.delete_inventory_item_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.delete_inventory_item_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_name TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat menghapus inventaris.';
    END IF;

    SELECT name INTO v_name FROM public.inventory_items WHERE id = p_id;
    DELETE FROM public.inventory_items WHERE id = p_id;

    PERFORM public.log_activity(
        p_caller_id, 
        'INVENTORY_MANAGEMENT', 
        'Menghapus barang inventaris: ' || COALESCE(v_name, 'ID ' || p_id::TEXT), 
        jsonb_build_object('id', p_id, 'name', v_name)
    );
END; $$;


-- 1.4 insert_feedback_secure
DROP FUNCTION IF EXISTS public.insert_feedback_secure(BIGINT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.insert_feedback_secure(
    p_caller_id BIGINT,
    p_category TEXT,
    p_content TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.feedback (custom_user_id, category, content)
    VALUES (p_caller_id, p_category, p_content);

    PERFORM public.log_activity(
        p_caller_id, 
        'FEEDBACK_SUBMISSION', 
        'Mengirim feedback kategori ' || p_category, 
        jsonb_build_object('category', p_category)
    );
END; $$;


-- 1.5 upsert_external_link_secure
DROP FUNCTION IF EXISTS public.upsert_external_link_secure(BIGINT, BIGINT, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.upsert_external_link_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_title TEXT,
    p_url TEXT,
    p_is_active BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_action TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat mengelola tautan.';
    END IF;

    IF p_id IS NULL OR p_id = 0 THEN
        INSERT INTO public.external_links (title, url, is_active)
        VALUES (p_title, p_url, p_is_active);
        v_action := 'Menambah tautan eksternal baru: ' || p_title;
    ELSE
        UPDATE public.external_links SET
            title = p_title, url = p_url, is_active = p_is_active
        WHERE id = p_id;
        v_action := 'Mengubah tautan eksternal ID ' || p_id::TEXT || ': ' || p_title;
    END IF;

    PERFORM public.log_activity(
        p_caller_id, 
        'LINK_MANAGEMENT', 
        v_action, 
        jsonb_build_object('title', p_title, 'url', p_url, 'is_active', p_is_active)
    );
END; $$;


-- 1.6 delete_external_link_secure
DROP FUNCTION IF EXISTS public.delete_external_link_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.delete_external_link_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_title TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat menghapus tautan.';
    END IF;

    SELECT title INTO v_title FROM public.external_links WHERE id = p_id;
    DELETE FROM public.external_links WHERE id = p_id;

    PERFORM public.log_activity(
        p_caller_id, 
        'LINK_MANAGEMENT', 
        'Menghapus tautan eksternal: ' || COALESCE(v_title, 'ID ' || p_id::TEXT), 
        jsonb_build_object('id', p_id, 'title', v_title)
    );
END; $$;


-- 1.7 admin_save_division_access
DROP FUNCTION IF EXISTS public.admin_save_division_access(BIGINT, TEXT, TEXT[]);
CREATE OR REPLACE FUNCTION public.admin_save_division_access(
    p_caller_id BIGINT,
    p_division TEXT,
    p_menu_keys TEXT[]
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak: Hanya koordinator yang dapat mengelola hak akses.';
    END IF;

    DELETE FROM public.division_access WHERE division = p_division;

    IF p_menu_keys IS NOT NULL AND array_length(p_menu_keys, 1) > 0 THEN
        INSERT INTO public.division_access (division, menu_key)
        SELECT p_division, unnest(p_menu_keys);
    END IF;

    PERFORM public.log_activity(
        p_caller_id, 
        'DIVISION_ACCESS_MANAGEMENT', 
        'Mengubah hak akses menu divisi ' || p_division, 
        jsonb_build_object('division', p_division, 'menu_keys', p_menu_keys)
    );
END; $$;


-- 1.8 admin_update_system_setting
DROP FUNCTION IF EXISTS public.admin_update_system_setting(BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_update_system_setting(
    p_caller_id BIGINT,
    p_active_shift TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    UPDATE public.system_settings SET active_shift = p_active_shift, updated_at = NOW();
    
    IF NOT FOUND THEN
        INSERT INTO public.system_settings (active_shift) VALUES (p_active_shift);
    END IF;

    PERFORM public.log_activity(
        p_caller_id, 
        'SYSTEM_SETTINGS', 
        'Mengubah shift aktif menjadi ' || p_active_shift, 
        jsonb_build_object('active_shift', p_active_shift)
    );
END; $$;


-- 1.9 admin_update_global_settings_secure
DROP FUNCTION IF EXISTS public.admin_update_global_settings_secure(BIGINT, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.admin_update_global_settings_secure(
    p_caller_id BIGINT,
    p_semester_active TEXT,
    p_announcement TEXT,
    p_is_recruitment_open BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

    PERFORM public.log_activity(
        p_caller_id, 
        'SYSTEM_SETTINGS', 
        'Mengubah pengaturan global (Semester: ' || p_semester_active || ')', 
        jsonb_build_object('semester_active', p_semester_active, 'announcement', p_announcement, 'is_recruitment_open', p_is_recruitment_open)
    );
END; $$;


-- =====================================================
-- 2. UTILITY OPERATIONS (Add SET search_path)
-- =====================================================

-- 2.1 update_qr_session_token_secure
DROP FUNCTION IF EXISTS public.update_qr_session_token_secure(BIGINT, BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.update_qr_session_token_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_token TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;
    UPDATE public.qr_sessions SET token = p_token WHERE id = p_id;
END; $$;


-- 2.2 stop_qr_session_secure
DROP FUNCTION IF EXISTS public.stop_qr_session_secure(BIGINT, BIGINT);
CREATE OR REPLACE FUNCTION public.stop_qr_session_secure(
    p_caller_id BIGINT,
    p_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;
    UPDATE public.qr_sessions SET is_active = FALSE WHERE id = p_id;
END; $$;


-- 2.3 get_division_access_secure
DROP FUNCTION IF EXISTS public.get_division_access_secure(BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.get_division_access_secure(
    p_viewer_id BIGINT,
    p_division TEXT
) RETURNS TABLE (menu_key TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;
    RETURN QUERY SELECT da.menu_key FROM public.division_access da WHERE da.division = p_division;
END; $$;


-- =====================================================
-- 3. READ OPERATIONS (Enforce caller verification)
-- =====================================================

-- 3.1 get_schedule_assignments_secure
DROP FUNCTION IF EXISTS public.get_schedule_assignments_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_schedule_assignments_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    schedule_id TEXT,
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
    IF NOT public.is_staff(p_viewer_id) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat melihat jadwal jaga.';
    END IF;

    RETURN QUERY
    SELECT sa.id::BIGINT, sa.schedule_id::TEXT, s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME, s.end_time::TIME, s.major::TEXT, s.class_code::TEXT,
           u.id::BIGINT, u.full_name::TEXT, ou.id::BIGINT, ou.full_name::TEXT, sa.substitute_user_id::BIGINT,
           sa.task_role::TEXT, sa.activity_name::TEXT, sa.activity_date::DATE, sa.status::TEXT
    FROM public.schedule_assignments sa
    JOIN public.schedules s ON sa.schedule_id::TEXT = s.id::TEXT
    LEFT JOIN public.users u ON sa.user_id = u.id
    LEFT JOIN public.users ou ON sa.original_user_id = ou.id
    ORDER BY sa.activity_date DESC, s.start_time ASC;
END; $$;


-- 3.2 get_schedules_secure
DROP FUNCTION IF EXISTS public.get_schedules_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_schedules_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id TEXT,
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
    IF NOT public.is_staff(p_viewer_id) THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    RETURN QUERY 
    SELECT s.id::TEXT, s.title::TEXT, s.major::TEXT, s.class_code::TEXT, s.day_of_week::TEXT, s.start_time::TIME, s.end_time::TIME, s.type::TEXT, s.status::TEXT
    FROM public.schedules s
    ORDER BY s.day_of_week ASC, s.start_time ASC;
END; $$;


-- 3.3 get_inventory_items_secure
DROP FUNCTION IF EXISTS public.get_inventory_items_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_inventory_items_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    condition TEXT,
    quantity INTEGER,
    location TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya staff yang dapat melihat inventaris.';
    END IF;

    RETURN QUERY 
    SELECT ii.id::BIGINT, ii.name::TEXT, ii.condition::TEXT, ii.quantity::INTEGER, ii.location::TEXT 
    FROM public.inventory_items ii 
    ORDER BY ii.name ASC;
END; $$;


-- 3.4 get_system_settings_full_secure
DROP FUNCTION IF EXISTS public.get_system_settings_full_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_system_settings_full_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    semester_active TEXT,
    announcement TEXT,
    is_recruitment_open BOOLEAN,
    active_shift TEXT,
    updated_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    RETURN QUERY 
    SELECT ss.id, ss.semester_active, ss.announcement, ss.is_recruitment_open, ss.active_shift, ss.updated_at 
    FROM public.system_settings ss 
    LIMIT 1;
END; $$;


-- =====================================================
-- 4. RLS POLICY HARDENING
-- =====================================================

-- Lock down direct public access to attendance_logs table
DROP POLICY IF EXISTS "Anyone can read attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "authenticated can read own attendance logs" ON public.attendance_logs;

CREATE POLICY "attendance_logs_lockdown" ON public.attendance_logs 
    FOR SELECT TO authenticated, anon USING (false);


-- =====================================================
-- 5. RE-LOCK ALL FUNCTIONS EXECUTE PRIVILEGES
-- =====================================================
-- Ensure that any drop-then-recreated function is restricted from anon/authenticated execution.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, public;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Restore public RPCs execute privileges selectively
GRANT EXECUTE ON FUNCTION public.login_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_exists(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_qr_session_secure(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_renter_items_secure() TO anon, authenticated;
