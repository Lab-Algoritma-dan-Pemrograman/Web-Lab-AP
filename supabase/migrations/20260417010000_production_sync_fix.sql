-- =====================================================
-- Migration: COMPREHENSIVE MASTER REPAIR (V5)
-- Resolve: Dashboard Stats, Inventaris, Manajemen Kelas, UUID Errors
-- =====================================================

-- 1. UTILITY: Helper to Drop All Overloads (Aggressive)
DO $$ DECLARE
    r record;
BEGIN
    FOR r IN (SELECT proname, oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace 
              AND proname IN (
                  'get_dashboard_stats_secure', 'get_attendance_logs_secure', 
                  'get_elearning_progress_secure', 'get_schedules_secure',
                  'get_inventory_items_secure', 'upsert_inventory_item_secure', 'delete_inventory_item_secure',
                  'get_group_assistants_secure', 'get_group_members_secure', 'get_assistant_availability_secure',
                  'sync_students_to_group_secure', 'update_group_members_batch_secure', 'reset_group_plotting_secure',
                  'get_all_group_members_secure', 'upsert_group_assistant_secure', 'delete_group_assistant_secure',
                  'get_financial_records_secure', 'check_menu_access_secure'
              ))
    LOOP
        EXECUTE 'DROP FUNCTION public.' || r.proname || '(' || pg_get_function_identity_arguments(r.oid) || ') CASCADE';
    END LOOP;
END $$;

-- 2. DASHBOARD & PROFILE
-- Expanded with counts for Praktikan, Asisten, and Attendance Rate
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_secure(p_viewer_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role TEXT; v_full_name TEXT; v_phone TEXT; v_nim TEXT;
    v_total_users BIGINT; v_total_assistants BIGINT; v_total_students BIGINT;
    v_total_feedback BIGINT; v_pending_attendance BIGINT; v_pending_asst_req BIGINT;
    v_upcoming_shifts BIGINT; v_my_classes BIGINT; v_my_students BIGINT;
    v_attendance_rate DECIMAL; v_my_attendance_count BIGINT;
BEGIN
    -- Basic Profile
    SELECT u.role, u.full_name, u.phone_number, u.username INTO v_role, v_full_name, v_phone, v_nim FROM public.users u WHERE u.id = p_viewer_id;
    
    -- Global Counts (Staff Only)
    SELECT COUNT(*) INTO v_total_users FROM public.users;
    SELECT COUNT(*) INTO v_total_assistants FROM public.users WHERE role IN ('asisten', 'koordinator');
    SELECT COUNT(*) INTO v_total_students FROM public.users WHERE role = 'praktikan';
    SELECT COUNT(*) INTO v_total_feedback FROM public.feedback;
    SELECT COUNT(*) INTO v_pending_attendance FROM public.attendance_logs WHERE verification_status = 'pending';
    -- v_pending_asst_req = swaps/reschedules pending (if table exists)
    
    -- Role Specific
    IF v_role = 'praktikan' THEN
        SELECT COUNT(*) INTO v_my_classes FROM public.group_members WHERE student_id = p_viewer_id;
        SELECT COUNT(*) INTO v_my_attendance_count FROM public.attendance_logs WHERE custom_user_id = p_viewer_id AND status = 'Hadir';
        -- Rate calculation: (Hadir / entries) * 100
        SELECT COALESCE(ROUND((v_my_attendance_count * 100.0) / NULLIF(COUNT(*), 0), 1), 0) INTO v_attendance_rate 
        FROM public.attendance_logs WHERE custom_user_id = p_viewer_id;
    ELSE
        -- Assistant/Koordinator
        SELECT COUNT(*) INTO v_my_classes FROM public.group_assistants WHERE assistant_id = p_viewer_id;
        SELECT COUNT(*) INTO v_my_students FROM public.group_members WHERE assistant_id = p_viewer_id;
        SELECT COUNT(*) INTO v_upcoming_shifts FROM public.schedule_assignments WHERE user_id = p_viewer_id AND activity_date >= CURRENT_DATE;
    END IF;

    RETURN jsonb_build_object(
        'user_role', v_role, 'user_name', v_full_name, 'user_phone', v_phone,
        'total_users', v_total_users, 'total_assistants', v_total_assistants, 'total_students', v_total_students,
        'total_feedback', v_total_feedback, 'pending_attendance', v_pending_attendance,
        'total_kelas', v_my_classes, 'total_students_under_me', v_my_students, 
        'upcoming_shifts_count', v_upcoming_shifts, 'attendance_rate', v_attendance_rate,
        'my_attendance_count', v_my_attendance_count
    );
END; $$;

-- 3. ATTENDANCE & FILTERING
CREATE OR REPLACE FUNCTION public.get_attendance_logs_secure(p_viewer_id BIGINT, p_date_filter DATE DEFAULT NULL)
RETURNS TABLE (
    id BIGINT, status TEXT, notes TEXT, check_in_time TIMESTAMP WITH TIME ZONE, is_verified BOOLEAN, verification_status TEXT, reschedule_status TEXT, reschedule_schedule_id TEXT, user_id BIGINT, user_full_name TEXT, user_role TEXT, user_username TEXT, user_major TEXT, user_class_code TEXT, user_shift TEXT, user_phone_number TEXT, schedule_title TEXT, schedule_day TEXT, schedule_time TIME
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT al.id::BIGINT, al.status::TEXT, al.notes::TEXT, al.check_in_time::TIMESTAMP WITH TIME ZONE, al.is_verified::BOOLEAN, al.verification_status::TEXT, al.reschedule_status::TEXT, al.reschedule_schedule_id::TEXT, u.id::BIGINT, u.full_name::TEXT, u.role::TEXT, u.username::TEXT, u.division::TEXT, u.class_code::TEXT, u.shift::TEXT, u.phone_number::TEXT, s.title::TEXT, s.day_of_week::TEXT, s.start_time::TIME
    FROM public.attendance_logs al 
    JOIN public.users u ON al.custom_user_id = u.id 
    LEFT JOIN public.schedules s ON al.reschedule_schedule_id::TEXT = s.id::TEXT
    WHERE (public.is_staff(p_viewer_id) OR al.custom_user_id = p_viewer_id)
      AND (p_date_filter IS NULL OR al.check_in_time::DATE = p_date_filter)
    ORDER BY al.check_in_time DESC;
END; $$;

-- 4. INVENTARIS MODULE
CREATE OR REPLACE FUNCTION public.get_inventory_items_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, name TEXT, condition TEXT, quantity INTEGER, location TEXT, updated_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT inv.id::BIGINT, inv.name::TEXT, inv.condition::TEXT, inv.quantity::INTEGER, inv.location::TEXT, inv.updated_at::TIMESTAMP WITH TIME ZONE
    FROM public.inventory_items inv ORDER BY inv.name ASC;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_inventory_item_secure(p_caller_id BIGINT, p_id BIGINT, p_name TEXT, p_condition TEXT, p_quantity INTEGER, p_location TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    IF p_id = 0 THEN
        INSERT INTO public.inventory_items (name, condition, quantity, location) VALUES (p_name, p_condition, p_quantity, p_location);
    ELSE
        UPDATE public.inventory_items SET name=p_name, condition=p_condition, quantity=p_quantity, location=p_location, updated_at=now() WHERE id=p_id;
    END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_inventory_item_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    DELETE FROM public.inventory_items WHERE id = p_id;
END; $$;

-- 5. MANAJEMEN KELAS & PLOTTING
CREATE OR REPLACE FUNCTION public.get_group_assistants_secure(p_viewer_id BIGINT, p_schedule_id TEXT)
RETURNS TABLE (id BIGINT, assistant_id BIGINT, assistant_name TEXT, schedule_id TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT ga.id::BIGINT, ga.assistant_id::BIGINT, u.full_name::TEXT, ga.schedule_id::TEXT
    FROM public.group_assistants ga JOIN public.users u ON ga.assistant_id = u.id 
    WHERE ga.schedule_id::TEXT = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_group_members_secure(p_viewer_id BIGINT, p_schedule_id TEXT)
RETURNS TABLE (id BIGINT, student_id BIGINT, student_name TEXT, student_nim TEXT, student_shift TEXT, assistant_id BIGINT, assistant_name TEXT, schedule_id TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT gm.id::BIGINT, gm.student_id::BIGINT, u.full_name::TEXT, u.username::TEXT, u.shift::TEXT, gm.assistant_id::BIGINT, a.full_name::TEXT, gm.schedule_id::TEXT
    FROM public.group_members gm 
    JOIN public.users u ON gm.student_id = u.id 
    LEFT JOIN public.users a ON gm.assistant_id = a.id
    WHERE gm.schedule_id::TEXT = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_assistant_availability_secure(p_viewer_id BIGINT, p_day TEXT, p_start TIME, p_end TIME)
RETURNS TABLE (user_id BIGINT, user_full_name TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT u.id::BIGINT, u.full_name::TEXT FROM public.users u
    WHERE u.role IN ('asisten', 'koordinator')
    AND EXISTS (
        SELECT 1 FROM public.assistant_availability aa 
        WHERE aa.user_id = u.id AND aa.day_of_week = p_day AND aa.is_available = true
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.group_assistants ga JOIN public.schedules s ON ga.schedule_id = s.id
        WHERE ga.assistant_id = u.id AND s.day_of_week = p_day
        AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
    );
END; $$;

CREATE OR REPLACE FUNCTION public.sync_students_to_group_secure(p_caller_id BIGINT, p_schedule_id TEXT, p_major TEXT, p_class_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    -- Insert students who match class but NOT yet in group_members for this schedule
    INSERT INTO public.group_members (student_id, schedule_id)
    SELECT u.id, p_schedule_id::UUID FROM public.users u
    WHERE u.role = 'praktikan' AND u.division = p_major AND u.class_code = p_class_code
    AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.student_id = u.id AND gm.schedule_id = p_schedule_id::UUID);
END; $$;

CREATE OR REPLACE FUNCTION public.update_group_members_batch_secure(p_caller_id BIGINT, p_updates JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    FOR r IN SELECT * FROM jsonb_to_recordset(p_updates) AS x(id BIGINT, assistant_id BIGINT) LOOP
        UPDATE public.group_members SET assistant_id = r.assistant_id WHERE id = r.id;
    END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.reset_group_plotting_secure(p_caller_id BIGINT, p_schedule_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    UPDATE public.group_members SET assistant_id = NULL WHERE schedule_id::TEXT = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_group_assistant_secure(p_caller_id BIGINT, p_schedule_id TEXT, p_assistant_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    INSERT INTO public.group_assistants (schedule_id, assistant_id) VALUES (p_schedule_id::UUID, p_assistant_id)
    ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_group_assistant_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    DELETE FROM public.group_assistants WHERE id = p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_all_group_members_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    student_name TEXT, student_nim TEXT, assistant_name TEXT, schedule_title TEXT, schedule_major TEXT, schedule_class_code TEXT, schedule_day TEXT, schedule_start TIME, schedule_end TIME
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT u.full_name::TEXT, u.username::TEXT, a.full_name::TEXT, s.title::TEXT, s.major::TEXT, s.class_code::TEXT, s.day_of_week::TEXT, s.start_time::TIME, s.end_time::TIME
    FROM public.group_members gm JOIN public.users u ON gm.student_id = u.id LEFT JOIN public.users a ON gm.assistant_id = a.id JOIN public.schedules s ON gm.schedule_id = s.id;
END; $$;

-- 6. FINANCE & MISC
CREATE OR REPLACE FUNCTION public.get_financial_records_secure(p_viewer_id BIGINT)
RETURNS TABLE (id BIGINT, title TEXT, amount NUMERIC, type TEXT, category TEXT, date TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    RETURN QUERY SELECT fr.id::BIGINT, fr.title::TEXT, fr.amount::NUMERIC, fr.type::TEXT, fr.category::TEXT, COALESCE(fr.date, fr.created_at)::TIMESTAMP WITH TIME ZONE
    FROM public.financial_records fr ORDER BY fr.date DESC, fr.created_at DESC;
END; $$;

-- Re-implementation of other core functions from V3 to ensure completeness
CREATE OR REPLACE FUNCTION public.get_elearning_progress_secure(p_viewer_id BIGINT)
RETURNS TABLE (id TEXT, nim TEXT, student_name TEXT, completed_lessons INTEGER, total_lessons INTEGER, completion_percentage DECIMAL, is_completed BOOLEAN, completed_levels JSONB, current_level TEXT, last_accessed_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.get_schedules_secure(p_viewer_id BIGINT)
RETURNS TABLE (id TEXT, title TEXT, major TEXT, class_code TEXT, day_of_week TEXT, start_time TIME, end_time TIME, type TEXT, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT s.id::TEXT, s.title::TEXT, s.major::TEXT, s.class_code::TEXT, s.day_of_week::TEXT, s.start_time::TIME, s.end_time::TIME, s.type::TEXT, s.status::TEXT
    FROM public.schedules s;
END; $$;
