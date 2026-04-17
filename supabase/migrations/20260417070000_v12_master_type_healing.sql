-- =====================================================
-- Migration: ULTIMATE MASTER TYPE HEALING (V11+V12)
-- Resolve: BIGINT vs UUID Mismatch (Fixing error "23")
-- Resolve: Column Schema Alignment (Total_Quantity, Amount)
-- Resolve: Missing Buttons & Access Control
-- =====================================================

-- 0. SCHEMA ADAPTATION (Safety layer)
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 1. UTILITY: Extensive purge of conflicting signatures
DO $$ DECLARE
    r record;
BEGIN
    FOR r IN (SELECT proname, oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace 
              AND proname IN (
                  'get_users_secure', 'get_inventory_items_secure', 'get_financial_records_secure',
                  'upsert_inventory_item_secure', 'upsert_financial_record_secure',
                  'sync_students_to_group_secure', 'get_dashboard_stats_secure',
                  'check_menu_access_secure', 'is_staff', 'is_admin',
                  'get_group_members_secure', 'get_group_assistants_secure',
                  'update_group_members_batch_secure', 'reset_group_plotting_secure',
                  'upsert_group_assistant_secure', 'delete_group_assistant_secure',
                  'get_assistant_availability_secure', 'get_all_group_members_secure',
                  'get_attendance_logs_secure', 'get_schedules_secure', 'admin_verify_attendance_secure'
              ))
    LOOP
        EXECUTE 'DROP FUNCTION public.' || r.proname || '(' || pg_get_function_identity_arguments(r.oid) || ') CASCADE';
    END LOOP;
END $$;

-- 2. CORE HELPERS (V12 BIGINT Standard)
CREATE OR REPLACE FUNCTION public.is_staff(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role IN ('koordinator', 'asisten', 'sekretaris', 'k3'));
END; $$;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role IN ('koordinator', 'sekretaris'));
END; $$;

CREATE OR REPLACE FUNCTION public.check_menu_access_secure(p_viewer_id BIGINT, p_menu_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_div TEXT;
BEGIN
    SELECT u.division INTO v_div FROM public.users u WHERE u.id = p_viewer_id;
    -- COORDINATOR BYPASS
    IF EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer_id AND role = 'koordinator') THEN RETURN TRUE; END IF;
    -- ASISTEN CHECK
    RETURN EXISTS (SELECT 1 FROM public.division_access WHERE division = v_div AND menu_key = p_menu_key);
END; $$;

-- 3. MODULE FUNCTIONS (V12 POSITION-MATCHING & BIGINT)

-- 3.1: Users (Fixed Ambiguity & Created_At)
CREATE OR REPLACE FUNCTION public.get_users_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT, username TEXT, full_name TEXT, phone_number TEXT, role TEXT, 
    nim TEXT, assistant_code TEXT, division TEXT, class_code TEXT, 
    shift TEXT, is_active BOOLEAN, created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT u.id::BIGINT, u.username::TEXT, u.full_name::TEXT, u.phone_number::TEXT, u.role::TEXT, u.nim::TEXT, u.assistant_code::TEXT, u.division::TEXT, u.class_code::TEXT, u.shift::TEXT, u.is_active::BOOLEAN, u.created_at::TIMESTAMP WITH TIME ZONE 
    FROM public.users u ORDER BY u.role ASC, u.full_name ASC;
END; $$;

-- 3.2: Schedules (V12 BIGINT Support)
CREATE OR REPLACE FUNCTION public.get_schedules_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, title TEXT, major TEXT, class_code TEXT, day_of_week TEXT, start_time TIME, end_time TIME, type TEXT, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Cast id to BIGINT to handle numeric IDs like "23"
    RETURN QUERY SELECT s.id::BIGINT, s.title, s.major, s.class_code, s.day_of_week, s.start_time, s.end_time, s.type, s.status 
    FROM public.schedules s;
END; $$;

-- 3.3: Inventory (Mapping total_quantity AS quantity)
CREATE OR REPLACE FUNCTION public.get_inventory_items_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, name TEXT, condition TEXT, quantity INTEGER, location TEXT, updated_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ii.id::BIGINT, ii.name::TEXT, ii.condition::TEXT, 
           COALESCE(ii.quantity, ii.total_quantity)::INTEGER, 
           ii.location::TEXT, ii.updated_at::TIMESTAMP WITH TIME ZONE 
    FROM public.inventory_items ii ORDER BY ii.name ASC;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_inventory_item_secure(p_caller_id BIGINT, p_id BIGINT, p_name TEXT, p_condition TEXT, p_quantity INTEGER, p_location TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    IF p_id = 0 OR p_id IS NULL THEN
        INSERT INTO public.inventory_items (name, condition, quantity, total_quantity, location, updated_at) VALUES (p_name, p_condition, p_quantity, p_quantity, p_location, now());
    ELSE
        UPDATE public.inventory_items SET name = p_name, condition = p_condition, quantity = p_quantity, total_quantity = p_quantity, location = p_location, updated_at = now() WHERE id = p_id;
    END IF;
END; $$;

-- 3.4: Finance (Standard Numeric)
CREATE OR REPLACE FUNCTION public.get_financial_records_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, title TEXT, amount NUMERIC, type TEXT, category TEXT, date DATE, created_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT fr.id::BIGINT, fr.title::TEXT, fr.amount::NUMERIC, fr.type::TEXT, fr.category::TEXT, fr.date::DATE, fr.created_at::TIMESTAMP WITH TIME ZONE 
    FROM public.financial_records fr ORDER BY fr.date DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_financial_record_secure(p_caller_id BIGINT, p_id BIGINT, p_title TEXT, p_amount NUMERIC, p_type TEXT, p_category TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    IF p_id = 0 OR p_id IS NULL THEN
        INSERT INTO public.financial_records (title, amount, type, category, date, created_at) VALUES (p_title, p_amount, p_type, p_category, CURRENT_DATE, now());
    ELSE
        UPDATE public.financial_records SET title = p_title, amount = p_amount, type = p_type, category = p_category WHERE id = p_id;
    END IF;
END; $$;

-- 3.5: Group Members (V12 BIGINT)
CREATE OR REPLACE FUNCTION public.get_group_members_secure(p_viewer_id BIGINT, p_schedule_id BIGINT) --- USED BIGINT
RETURNS TABLE (id BIGINT, schedule_id BIGINT, student_id BIGINT, assistant_id BIGINT, student_name TEXT, student_nim TEXT, assistant_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT gm.id::BIGINT, gm.schedule_id::BIGINT, gm.student_id::BIGINT, gm.assistant_id::BIGINT, u_s.full_name::TEXT, u_s.username::TEXT, u_a.full_name::TEXT
    FROM public.group_members gm JOIN public.users u_s ON gm.student_id = u_s.id LEFT JOIN public.users u_a ON gm.assistant_id = u_a.id
    WHERE (p_schedule_id IS NULL OR gm.schedule_id = p_schedule_id)
      AND (public.is_staff(p_viewer_id) OR gm.student_id = p_viewer_id);
END; $$;

CREATE OR REPLACE FUNCTION public.get_group_assistants_secure(p_viewer_id BIGINT, p_schedule_id BIGINT) --- USED BIGINT
RETURNS TABLE (id BIGINT, assistant_id BIGINT, assistant_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ga.id::BIGINT, ga.assistant_id::BIGINT, u.full_name::TEXT
    FROM public.group_assistants ga JOIN public.users u ON ga.assistant_id = u.id
    WHERE ga.schedule_id = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.sync_students_to_group_secure(p_caller_id BIGINT, p_schedule_id BIGINT, p_major TEXT, p_class_code TEXT) --- FIXED BIGINT
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    INSERT INTO public.group_members (schedule_id, student_id)
    SELECT p_schedule_id, u.id FROM public.users u 
    WHERE u.role = 'praktikan' AND u.division = p_major AND u.class_code = p_class_code
    ON CONFLICT (schedule_id, student_id) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.reset_group_plotting_secure(p_caller_id BIGINT, p_schedule_id BIGINT) --- FIXED BIGINT
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    UPDATE public.group_members SET assistant_id = NULL WHERE schedule_id = p_schedule_id;
END; $$;

-- 3.6: Attendance Logs (V12 Defensive Join)
CREATE OR REPLACE FUNCTION public.get_attendance_logs_secure(p_viewer_id BIGINT, p_date_filter DATE DEFAULT NULL)
RETURNS TABLE (
    id BIGINT, status TEXT, notes TEXT, check_in_time TIMESTAMP WITH TIME ZONE, is_verified BOOLEAN, verification_status TEXT, reschedule_status TEXT, reschedule_schedule_id BIGINT, user_id BIGINT, user_full_name TEXT, user_role TEXT, user_username TEXT, user_major TEXT, user_class_code TEXT, user_shift TEXT, user_phone_number TEXT, schedule_title TEXT, schedule_day TEXT, schedule_time TIME, type TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time::TIMESTAMP WITH TIME ZONE, al.is_verified::BOOLEAN, al.verification_status::TEXT, al.reschedule_status::TEXT, al.reschedule_schedule_id::BIGINT, u.id::BIGINT, u.full_name::TEXT, u.role::TEXT, u.username::TEXT, u.division::TEXT, u.class_code::TEXT, u.shift::TEXT, u.phone_number::TEXT, s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME, al.type::TEXT
    FROM public.attendance_logs al 
    JOIN public.users u ON al.custom_user_id = u.id 
    LEFT JOIN public.schedules s ON al.reschedule_schedule_id::TEXT = s.id::TEXT
    WHERE (public.is_staff(p_viewer_id) OR al.custom_user_id = p_viewer_id) AND (p_date_filter IS NULL OR al.check_in_time::DATE = p_date_filter)
    ORDER BY al.check_in_time DESC;
END; $$;

-- 4. DASHBOARD & PERMISSIONS
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_secure(p_viewer_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT; v_phone TEXT; v_stats JSONB;
BEGIN
    SELECT u.role, u.phone_number INTO v_role, v_phone FROM public.users u WHERE u.id = p_viewer_id;
    IF public.is_staff(p_viewer_id) THEN
        SELECT jsonb_build_object(
            'user_role', v_role, 'user_phone', v_phone,
            'total_users', (SELECT count(*) FROM public.users),
            'total_students', (SELECT count(*) FROM public.users WHERE role = 'praktikan'),
            'total_assistants', (SELECT count(*) FROM public.users WHERE role IN ('asisten', 'koordinator')),
            'pending_approval', (SELECT count(*) FROM public.attendance_logs WHERE verification_status = 'pending'),
            'total_feedback', (SELECT count(*) FROM public.feedback)
        ) INTO v_stats;
    ELSE
        SELECT jsonb_build_object(
            'user_role', v_role, 'user_phone', v_phone,
            'attendance_rate', (SELECT COALESCE(ROUND((COUNT(*) FILTER (WHERE status = 'Hadir') * 100.0) / NULLIF(COUNT(*), 0), 1), 0) FROM public.attendance_logs WHERE custom_user_id = p_viewer_id),
            'total_kelas', (SELECT count(*) FROM public.group_members WHERE student_id = p_viewer_id)
        ) INTO v_stats;
    END IF;
    RETURN v_stats;
END; $$;

GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
