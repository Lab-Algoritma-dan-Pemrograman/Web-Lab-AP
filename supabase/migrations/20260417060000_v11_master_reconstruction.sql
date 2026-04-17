-- =====================================================
-- Migration: ULTIMATE MASTER RECONSTRUCTION (V11)
-- Resolve: "Ambiguous ID" Crash in User Management
-- Resolve: "Missing Buttons" (Permissions) in Class Management
-- Resolve: Column Schema Divergence (Quantity, Amount)
-- =====================================================

-- 0. SCHEMA ADAPTATION (Safety layer)
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 1. UTILITY: Aggressive purge of broken signatures to clear PostgREST cache
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
                  'get_assistant_availability_secure', 'get_all_group_members_secure'
              ))
    LOOP
        EXECUTE 'DROP FUNCTION public.' || r.proname || '(' || pg_get_function_identity_arguments(r.oid) || ') CASCADE';
    END LOOP;
END $$;

-- 2. CORE HELPERS (V11 Standard)
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
    -- COORDINATOR BYPASS (Restores missing buttons)
    IF EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer_id AND role = 'koordinator') THEN RETURN TRUE; END IF;
    -- ASISTEN CHECK
    RETURN EXISTS (SELECT 1 FROM public.division_access WHERE division = v_div AND menu_key = p_menu_key);
END; $$;

-- 3. USER MANAGEMENT (Fixing "Ambiguous ID" by position-matching)
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

-- 4. INVENTORY (Mapping total_quantity AS quantity for UI)
CREATE OR REPLACE FUNCTION public.get_inventory_items_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, name TEXT, condition TEXT, quantity INTEGER, location TEXT, updated_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ii.id::BIGINT, ii.name::TEXT, ii.condition::TEXT, 
           COALESCE(ii.quantity, ii.total_quantity)::INTEGER, 
           ii.location::TEXT, ii.updated_at::TIMESTAMP WITH TIME ZONE 
    FROM public.inventory_items ii ORDER BY ii.name ASC;
END; $$;

-- 5. FINANCE (Standard Alignment)
CREATE OR REPLACE FUNCTION public.get_financial_records_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, title TEXT, amount NUMERIC, type TEXT, category TEXT, date DATE, created_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT fr.id::BIGINT, fr.title::TEXT, fr.amount::NUMERIC, fr.type::TEXT, fr.category::TEXT, fr.date::DATE, fr.created_at::TIMESTAMP WITH TIME ZONE 
    FROM public.financial_records fr ORDER BY fr.date DESC;
END; $$;

-- 6. CLASS MANAGEMENT (Restoring missing Sync/Plotting RPCs)
CREATE OR REPLACE FUNCTION public.get_group_members_secure(p_viewer_id BIGINT, p_schedule_id UUID)
RETURNS TABLE (id BIGINT, schedule_id UUID, student_id BIGINT, assistant_id BIGINT, student_name TEXT, student_nim TEXT, assistant_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT gm.id::BIGINT, gm.schedule_id, gm.student_id::BIGINT, gm.assistant_id::BIGINT, u_s.full_name::TEXT, u_s.username::TEXT, u_a.full_name::TEXT
    FROM public.group_members gm JOIN public.users u_s ON gm.student_id = u_s.id LEFT JOIN public.users u_a ON gm.assistant_id = u_a.id
    WHERE (p_schedule_id IS NULL OR gm.schedule_id = p_schedule_id)
      AND (public.is_staff(p_viewer_id) OR gm.student_id = p_viewer_id);
END; $$;

CREATE OR REPLACE FUNCTION public.get_group_assistants_secure(p_viewer_id BIGINT, p_schedule_id UUID)
RETURNS TABLE (id BIGINT, assistant_id BIGINT, assistant_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ga.id::BIGINT, ga.assistant_id::BIGINT, u.full_name::TEXT
    FROM public.group_assistants ga JOIN public.users u ON ga.assistant_id = u.id
    WHERE ga.schedule_id = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.sync_students_to_group_secure(p_caller_id BIGINT, p_schedule_id UUID, p_major TEXT, p_class_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    INSERT INTO public.group_members (schedule_id, student_id)
    SELECT p_schedule_id, u.id FROM public.users u 
    WHERE u.role = 'praktikan' AND u.division = p_major AND u.class_code = p_class_code
    ON CONFLICT (schedule_id, student_id) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.update_group_members_batch_secure(p_caller_id BIGINT, p_updates JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item RECORD;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_updates) AS x(id BIGINT, assistant_id BIGINT)
    LOOP
        UPDATE public.group_members SET assistant_id = v_item.assistant_id WHERE id = v_item.id;
    END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.reset_group_plotting_secure(p_caller_id BIGINT, p_schedule_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    UPDATE public.group_members SET assistant_id = NULL WHERE schedule_id = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_group_assistant_secure(p_caller_id BIGINT, p_schedule_id UUID, p_assistant_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    INSERT INTO public.group_assistants (schedule_id, assistant_id) VALUES (p_schedule_id, p_assistant_id) ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_group_assistant_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    DELETE FROM public.group_assistants WHERE id = p_id;
END; $$;

-- 7. AVAILABILITY & DASHBOARD
CREATE OR REPLACE FUNCTION public.get_assistant_availability_secure(p_viewer_id BIGINT, p_day TEXT, p_start TIME, p_end TIME)
RETURNS TABLE (user_id BIGINT, user_full_name TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT aa.user_id::BIGINT, u.full_name::TEXT FROM public.assistant_availability aa JOIN public.users u ON aa.user_id = u.id WHERE aa.day_of_week = p_day AND aa.start_time <= p_start AND aa.end_time >= p_end;
END; $$;

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

-- 8. PERMISSIONS (Ensures cache refresh & client connectivity)
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
