-- =====================================================
-- Migration: FINAL MASTER STABILIZATION (V9)
-- Resolve: Column Schema Mismatches (Quantity, Created_At)
-- Resolve: RPC Data Loading (Users, Inventory, Finance)
-- =====================================================

-- 0. SCHEMA ADAPTATION (Force match the reality discovered in hardening audit)
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 1. UTILITY: Aggressive purge of potentially conflicting RPCs
DO $$ DECLARE
    r record;
BEGIN
    FOR r IN (SELECT proname, oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace 
              AND proname IN (
                  'get_users_secure', 'get_inventory_items_secure', 'get_financial_records_secure',
                  'upsert_inventory_item_secure', 'upsert_financial_record_secure',
                  'sync_students_to_group_secure', 'get_dashboard_stats_secure',
                  'check_menu_access_secure', 'get_system_settings_full_secure',
                  'admin_update_global_settings_secure', 'get_attendance_logs_secure'
              ))
    LOOP
        EXECUTE 'DROP FUNCTION public.' || r.proname || '(' || pg_get_function_identity_arguments(r.oid) || ') CASCADE';
    END LOOP;
END $$;

-- 2. USER MANAGEMENT (V9 Definitive)
CREATE OR REPLACE FUNCTION public.get_users_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT, username TEXT, full_name TEXT, phone_number TEXT, role TEXT, 
    nim TEXT, assistant_code TEXT, division TEXT, class_code TEXT, 
    shift TEXT, is_active BOOLEAN, created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer_id AND role IN ('koordinator', 'asisten', 'sekretaris')) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT u.id::BIGINT, u.username::TEXT, u.full_name::TEXT, u.phone_number::TEXT, u.role::TEXT, u.nim::TEXT, u.assistant_code::TEXT, u.division::TEXT, u.class_code::TEXT, u.shift::TEXT, u.is_active::BOOLEAN, u.created_at::TIMESTAMP WITH TIME ZONE 
    FROM public.users u ORDER BY u.role ASC, u.full_name ASC;
END; $$;

-- 3. INVENTORY (V9 Corrected Column: quantity)
CREATE OR REPLACE FUNCTION public.get_inventory_items_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, name TEXT, condition TEXT, quantity INTEGER, location TEXT, updated_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ii.id::BIGINT, ii.name::TEXT, ii.condition::TEXT, ii.quantity::INTEGER, ii.location::TEXT, ii.updated_at::TIMESTAMP WITH TIME ZONE 
    FROM public.inventory_items ii ORDER BY ii.name ASC;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_inventory_item_secure(p_caller_id BIGINT, p_id BIGINT, p_name TEXT, p_condition TEXT, p_quantity INTEGER, p_location TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_id AND role IN ('koordinator', 'asisten', 'k3')) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    IF p_id = 0 THEN
        INSERT INTO public.inventory_items (name, condition, quantity, location, updated_at) VALUES (p_name, p_condition, p_quantity, p_location, now());
    ELSE
        UPDATE public.inventory_items SET name = p_name, condition = p_condition, quantity = p_quantity, location = p_location, updated_at = now() WHERE id = p_id;
    END IF;
END; $$;

-- 4. FINANCE (V9 Corrected Signature)
CREATE OR REPLACE FUNCTION public.get_financial_records_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, title TEXT, amount NUMERIC, type TEXT, category TEXT, date DATE, created_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer_id AND role IN ('koordinator', 'sekretaris')) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT fr.id::BIGINT, fr.title::TEXT, fr.amount::NUMERIC, fr.type::TEXT, fr.category::TEXT, fr.date::DATE, fr.created_at::TIMESTAMP WITH TIME ZONE 
    FROM public.financial_records fr ORDER BY fr.date DESC, fr.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_financial_record_secure(p_caller_id BIGINT, p_id BIGINT, p_title TEXT, p_amount NUMERIC, p_type TEXT, p_category TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_id AND role IN ('koordinator', 'sekretaris')) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    IF p_id = 0 THEN
        INSERT INTO public.financial_records (title, amount, type, category, date, created_at) VALUES (p_title, p_amount, p_type, p_category, CURRENT_DATE, now());
    ELSE
        UPDATE public.financial_records SET title = p_title, amount = p_amount, type = p_type, category = p_category WHERE id = p_id;
    END IF;
END; $$;

-- 5. CLASS MANAGEMENT (V9 Fixed Column: Removed created_at)
CREATE OR REPLACE FUNCTION public.sync_students_to_group_secure(p_caller_id BIGINT, p_schedule_id UUID, p_major TEXT, p_class_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_id AND role IN ('koordinator', 'asisten')) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    INSERT INTO public.group_members (schedule_id, student_id)
    SELECT p_schedule_id, u.id FROM public.users u 
    WHERE u.role = 'praktikan' AND u.division = p_major AND u.class_code = p_class_code
    ON CONFLICT (schedule_id, student_id) DO NOTHING;
END; $$;

-- 6. SYSTEM SETTINGS (V9 Fixed WHERE)
CREATE OR REPLACE FUNCTION public.get_system_settings_full_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, semester_active TEXT, announcement TEXT, is_recruitment_open BOOLEAN, active_shift TEXT, updated_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ss.id::BIGINT, ss.semester_active::TEXT, ss.announcement::TEXT, ss.is_recruitment_open::BOOLEAN, ss.active_shift::TEXT, ss.updated_at::TIMESTAMP WITH TIME ZONE FROM public.system_settings ss LIMIT 1;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_global_settings_secure(p_caller_id BIGINT, p_semester_active TEXT, p_announcement TEXT, p_is_recruitment_open BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_id AND role = 'koordinator') THEN RAISE EXCEPTION 'Access Denied'; END IF;
    UPDATE public.system_settings SET semester_active = p_semester_active, announcement = p_announcement, is_recruitment_open = p_is_recruitment_open, updated_at = now()
    WHERE id = (SELECT id FROM public.system_settings LIMIT 1);
    IF NOT FOUND THEN
        INSERT INTO public.system_settings (semester_active, announcement, is_recruitment_open) VALUES (p_semester_active, p_announcement, p_is_recruitment_open);
    END IF;
END; $$;

-- 7. DASHBOARD & ATTENDANCE (V9 Self-Healing)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_secure(p_viewer_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role TEXT; v_phone TEXT; v_stats JSONB;
BEGIN
    SELECT u.role, u.phone_number INTO v_role, v_phone FROM public.users u WHERE u.id = p_viewer_id;
    IF v_role IN ('koordinator', 'asisten', 'sekretaris') THEN
        SELECT jsonb_build_object(
            'user_role', v_role, 'user_phone', v_phone,
            'total_users', (SELECT count(*) FROM public.users),
            'total_students', (SELECT count(*) FROM public.users WHERE role = 'praktikan'),
            'total_assistants', (SELECT count(*) FROM public.users WHERE role IN ('asisten', 'koordinator')),
            'pending_approval', (SELECT count(*) FROM public.attendance_logs WHERE verification_status = 'pending' AND (type IN ('izin', 'sakit', 'reschedule') OR status != 'Hadir')),
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

CREATE OR REPLACE FUNCTION public.get_attendance_logs_secure(p_viewer_id BIGINT, p_date_filter DATE DEFAULT NULL)
RETURNS TABLE (
    id BIGINT, status TEXT, notes TEXT, check_in_time TIMESTAMP WITH TIME ZONE, is_verified BOOLEAN, verification_status TEXT, reschedule_status TEXT, reschedule_schedule_id UUID, user_id BIGINT, user_full_name TEXT, user_role TEXT, user_username TEXT, user_major TEXT, user_class_code TEXT, user_shift TEXT, user_phone_number TEXT, schedule_title TEXT, schedule_day TEXT, schedule_time TIME, type TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Force type fix for reschedule column in the return
    RETURN QUERY SELECT al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time::TIMESTAMP WITH TIME ZONE, al.is_verified::BOOLEAN, al.verification_status::TEXT, al.reschedule_status::TEXT, NULLIF(al.reschedule_schedule_id, '')::UUID, u.id::BIGINT, u.full_name::TEXT, u.role::TEXT, u.username::TEXT, u.division::TEXT, u.class_code::TEXT, u.shift::TEXT, u.phone_number::TEXT, s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME, al.type::TEXT
    FROM public.attendance_logs al JOIN public.users u ON al.custom_user_id = u.id LEFT JOIN public.schedules s ON al.reschedule_schedule_id::TEXT = s.id::TEXT
    WHERE (public.is_staff(p_viewer_id) OR al.custom_user_id = p_viewer_id) AND (p_date_filter IS NULL OR al.check_in_time::DATE = p_date_filter)
    ORDER BY al.check_in_time DESC;
END; $$;
