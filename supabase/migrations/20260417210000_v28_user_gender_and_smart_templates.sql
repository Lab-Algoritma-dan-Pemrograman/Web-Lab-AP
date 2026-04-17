-- =====================================================
-- Migration: SMART TEMPLATES (V28 - REVISED FIX)
-- Purpose: Support smart messaging WITHOUT adding new columns
-- Resolve: Parse assistant_code for honorifics
-- Fix: schedule_id type mismatch (BIGINT instead of UUID)
-- =====================================================

-- 1. UPDATE get_personal_schedules_secure
-- We only add assistant_code to the output so the frontend can parse it
-- FIXED: schedule_id set to BIGINT to match V12 standard
DROP FUNCTION IF EXISTS public.get_personal_schedules_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_personal_schedules_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    role TEXT,
    schedule_id BIGINT, -- FIXED FROM UUID TO BIGINT
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
    assistant_phone TEXT,
    assistant_code TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
    SELECT u.role INTO v_role FROM public.users u WHERE u.id = p_viewer_id;
    IF v_role = 'praktikan' THEN
        RETURN QUERY
        SELECT v_role as role, s.id::BIGINT as schedule_id, s.title as schedule_title, s.day_of_week as schedule_day, s.start_time as schedule_start, s.end_time as schedule_end, s.major as schedule_major, s.class_code as schedule_class,
               u.id::BIGINT as student_id, u.full_name as student_name, u.username as student_nim, u.shift as student_shift,
               a.id::BIGINT as assistant_id, a.full_name as assistant_name, a.phone_number as assistant_phone, a.assistant_code as assistant_code
        FROM public.group_members gm
        JOIN public.schedules s ON gm.schedule_id = s.id
        JOIN public.users u ON gm.student_id = u.id
        LEFT JOIN public.users a ON gm.assistant_id = a.id
        WHERE gm.student_id = p_viewer_id;
    ELSIF v_role IN ('asisten', 'koordinator', 'sekretaris', 'k3') THEN
        RETURN QUERY
        SELECT v_role as role, s.id::BIGINT as schedule_id, s.title as schedule_title, s.day_of_week as schedule_day, s.start_time as schedule_start, s.end_time as schedule_end, s.major as schedule_major, s.class_code as schedule_class,
               stu.id::BIGINT as student_id, stu.full_name as student_name, stu.username as student_nim, stu.shift as student_shift,
               asst.id::BIGINT as assistant_id, asst.full_name as assistant_name, asst.phone_number as assistant_phone, asst.assistant_code as assistant_code
        FROM public.group_assistants ga
        JOIN public.schedules s ON ga.schedule_id = s.id
        JOIN public.users asst ON ga.assistant_id = asst.id
        LEFT JOIN public.group_members gm ON ga.schedule_id = gm.schedule_id AND ga.assistant_id = gm.assistant_id
        LEFT JOIN public.users stu ON gm.student_id = stu.id
        WHERE ga.assistant_id = p_viewer_id;
    END IF;
END; $$;

-- 2. GRANTS
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
