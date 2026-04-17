-- =====================================================
-- Migration: CONSERVATIVE MASTER STABILIZATION (V10)
-- Resolve: RPC 404s & Schema Crashes while PROTECTING UI Logic
-- =====================================================

-- 0. SCHEMA ADAPTATION (Only what is strictly necessary)
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 1. UTILITY: Targeted drop to clear out broken signatures
DO $$ DECLARE
    r record;
BEGIN
    FOR r IN (SELECT proname, oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace 
              AND proname IN (
                  'get_users_secure', 'get_inventory_items_secure', 'get_financial_records_secure',
                  'upsert_inventory_item_secure', 'upsert_financial_record_secure',
                  'sync_students_to_group_secure', 'get_dashboard_stats_secure',
                  'check_menu_access_secure', 'get_system_settings_full_secure',
                  'admin_update_global_settings_secure', 'get_attendance_logs_secure',
                  'get_all_group_members_secure', 'get_group_assistants_secure', 'get_group_members_secure',
                  'upsert_group_assistant_secure', 'delete_group_assistant_secure',
                  'update_group_members_batch_secure', 'reset_group_plotting_secure'
              ))
    LOOP
        EXECUTE 'DROP FUNCTION public.' || r.proname || '(' || pg_get_function_identity_arguments(r.oid) || ') CASCADE';
    END LOOP;
END $$;

-- 2. USER MANAGEMENT (Preserving UI Mapping)
CREATE OR REPLACE FUNCTION public.get_users_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT, username TEXT, full_name TEXT, phone_number TEXT, role TEXT, 
    nim TEXT, assistant_code TEXT, division TEXT, class_code TEXT, 
    shift TEXT, is_active BOOLEAN, created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT u.id::BIGINT, u.username::TEXT, u.full_name::TEXT, u.phone_number::TEXT, u.role::TEXT, u.nim::TEXT, u.assistant_code::TEXT, u.division::TEXT, u.class_code::TEXT, u.shift::TEXT, u.is_active::BOOLEAN, u.created_at::TIMESTAMP WITH TIME ZONE 
    FROM public.users u ORDER BY u.role ASC, u.full_name ASC;
END; $$;

-- 3. INVENTORY (Mapping DB 'total_quantity' to UI 'quantity')
CREATE OR REPLACE FUNCTION public.get_inventory_items_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, name TEXT, condition TEXT, quantity INTEGER, location TEXT, updated_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ii.id::BIGINT, ii.name::TEXT, ii.condition::TEXT, 
           COALESCE(ii.quantity, ii.total_quantity)::INTEGER as quantity, 
           ii.location::TEXT, ii.updated_at::TIMESTAMP WITH TIME ZONE 
    FROM public.inventory_items ii ORDER BY ii.name ASC;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_inventory_item_secure(p_caller_id BIGINT, p_id BIGINT, p_name TEXT, p_condition TEXT, p_quantity INTEGER, p_location TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_id AND role IN ('koordinator', 'asisten', 'k3')) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    IF p_id = 0 THEN
        INSERT INTO public.inventory_items (name, condition, quantity, total_quantity, location, updated_at) VALUES (p_name, p_condition, p_quantity, p_quantity, p_location, now());
    ELSE
        UPDATE public.inventory_items SET name = p_name, condition = p_condition, quantity = p_quantity, total_quantity = p_quantity, location = p_location, updated_at = now() WHERE id = p_id;
    END IF;
END; $$;

-- 4. FINANCE (V10 Conservative)
CREATE OR REPLACE FUNCTION public.get_financial_records_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, title TEXT, amount NUMERIC, type TEXT, category TEXT, date DATE, created_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT fr.id::BIGINT, fr.title::TEXT, fr.amount::NUMERIC, fr.type::TEXT, fr.category::TEXT, fr.date::DATE, fr.created_at::TIMESTAMP WITH TIME ZONE 
    FROM public.financial_records fr ORDER BY fr.date DESC, fr.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_financial_record_secure(p_caller_id BIGINT, p_id BIGINT, p_title TEXT, p_amount NUMERIC, p_type TEXT, p_category TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_id = 0 OR p_id IS NULL THEN
        INSERT INTO public.financial_records (title, amount, type, category, date, created_at) VALUES (p_title, p_amount, p_type, p_category, CURRENT_DATE, now());
    ELSE
        UPDATE public.financial_records SET title = p_title, amount = p_amount, type = p_type, category = p_category WHERE id = p_id;
    END IF;
END; $$;

-- 5. CLASS MANAGEMENT (Fixed Sync & Plotting Signatures)
CREATE OR REPLACE FUNCTION public.sync_students_to_group_secure(p_caller_id BIGINT, p_schedule_id UUID, p_major TEXT, p_class_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.group_members (schedule_id, student_id)
    SELECT p_schedule_id, u.id FROM public.users u 
    WHERE u.role = 'praktikan' AND u.division = p_major AND u.class_code = p_class_code
    ON CONFLICT (schedule_id, student_id) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.get_group_members_secure(p_viewer_id BIGINT, p_schedule_id UUID)
RETURNS TABLE (id BIGINT, schedule_id UUID, student_id BIGINT, assistant_id BIGINT, student_name TEXT, student_nim TEXT, assistant_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT gm.id::BIGINT, gm.schedule_id, gm.student_id::BIGINT, gm.assistant_id::BIGINT, u_s.full_name::TEXT, u_s.username::TEXT, u_a.full_name::TEXT
    FROM public.group_members gm JOIN public.users u_s ON gm.student_id = u_s.id LEFT JOIN public.users u_a ON gm.assistant_id = u_a.id
    WHERE gm.schedule_id = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_group_assistants_secure(p_viewer_id BIGINT, p_schedule_id UUID)
RETURNS TABLE (id BIGINT, assistant_id BIGINT, assistant_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ga.id::BIGINT, ga.assistant_id::BIGINT, u.full_name::TEXT
    FROM public.group_assistants ga JOIN public.users u ON ga.assistant_id = u.id
    WHERE ga.schedule_id = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_all_group_members_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, schedule_class_code TEXT, schedule_major TEXT, schedule_title TEXT, schedule_day TEXT, schedule_start TIME, schedule_end TIME, assistant_name TEXT, student_name TEXT, student_nim TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT gm.id::BIGINT, s.class_code, s.major, s.title, s.day_of_week, s.start_time, s.end_time, u_a.full_name, u_s.full_name, u_s.username
    FROM public.group_members gm JOIN public.schedules s ON gm.schedule_id = s.id JOIN public.users u_s ON gm.student_id = u_s.id LEFT JOIN public.users u_a ON gm.assistant_id = u_a.id;
END; $$;

-- 6. SYSTEM SETTINGS
CREATE OR REPLACE FUNCTION public.get_system_settings_full_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, semester_active TEXT, announcement TEXT, is_recruitment_open BOOLEAN, active_shift TEXT, updated_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ss.id::BIGINT, ss.semester_active, ss.announcement, ss.is_recruitment_open, ss.active_shift, ss.updated_at FROM public.system_settings ss LIMIT 1;
END; $$;

-- 7. PLOTTING TOOLS (V10)
CREATE OR REPLACE FUNCTION public.update_group_members_batch_secure(p_caller_id BIGINT, p_updates JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item RECORD;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_updates) AS x(id BIGINT, assistant_id BIGINT)
    LOOP
        UPDATE public.group_members SET assistant_id = v_item.assistant_id WHERE id = v_item.id;
    END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.reset_group_plotting_secure(p_caller_id BIGINT, p_schedule_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.group_members SET assistant_id = NULL WHERE schedule_id = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_group_assistant_secure(p_caller_id BIGINT, p_schedule_id UUID, p_assistant_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.group_assistants (schedule_id, assistant_id) VALUES (p_schedule_id, p_assistant_id) ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_group_assistant_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    DELETE FROM public.group_assistants WHERE id = p_id;
END; $$;
