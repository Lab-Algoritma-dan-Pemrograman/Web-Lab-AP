-- =====================================================
-- Migration: SMART TEMPLATES (V28 - FINAL FIX)
-- Purpose: Support smart messaging WITHOUT adding new columns
-- Resolve: Parse assistant_code for honorifics
-- Fix: Deep structure alignment for get_personal_schedules_secure
-- =====================================================

-- 1. DROP old function to avoid signature conflicts
DROP FUNCTION IF EXISTS public.get_personal_schedules_secure(BIGINT);

-- 2. CREATE FUNCTION with explicit casting for every single column
CREATE OR REPLACE FUNCTION public.get_personal_schedules_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    role TEXT,
    schedule_id BIGINT,
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
    SELECT u.role::TEXT INTO v_role FROM public.users u WHERE u.id = p_viewer_id;
    
    IF v_role = 'praktikan' THEN
        RETURN QUERY
        SELECT 
            v_role::TEXT as role, 
            s.id::BIGINT as schedule_id, 
            s.title::TEXT as schedule_title, 
            s.day_of_week::TEXT as schedule_day, 
            s.start_time::TIME as schedule_start, 
            s.end_time::TIME as schedule_end, 
            s.major::TEXT as schedule_major, 
            s.class_code::TEXT as schedule_class,
            u.id::BIGINT as student_id, 
            u.full_name::TEXT as student_name, 
            u.username::TEXT as student_nim, 
            u.shift::TEXT as student_shift,
            a.id::BIGINT as assistant_id, 
            a.full_name::TEXT as assistant_name, 
            a.phone_number::TEXT as assistant_phone, 
            a.assistant_code::TEXT as assistant_code
        FROM public.group_members gm
        JOIN public.schedules s ON gm.schedule_id = s.id
        JOIN public.users u ON gm.student_id = u.id
        LEFT JOIN public.users a ON gm.assistant_id = a.id
        WHERE gm.student_id = p_viewer_id;
        
    ELSIF v_role IN ('asisten', 'koordinator', 'sekretaris', 'k3') THEN
        RETURN QUERY
        SELECT 
            v_role::TEXT as role, 
            s.id::BIGINT as schedule_id, 
            s.title::TEXT as schedule_title, 
            s.day_of_week::TEXT as schedule_day, 
            s.start_time::TIME as schedule_start, 
            s.end_time::TIME as schedule_end, 
            s.major::TEXT as schedule_major, 
            s.class_code::TEXT as schedule_class,
            stu.id::BIGINT as student_id, 
            stu.full_name::TEXT as student_name, 
            stu.username::TEXT as student_nim, 
            stu.shift::TEXT as student_shift,
            asst.id::BIGINT as assistant_id, 
            asst.full_name::TEXT as assistant_name, 
            asst.phone_number::TEXT as assistant_phone, 
            asst.assistant_code::TEXT as assistant_code
        FROM public.group_assistants ga
        JOIN public.schedules s ON ga.schedule_id = s.id
        JOIN public.users asst ON ga.assistant_id = asst.id
        LEFT JOIN public.group_members gm ON ga.schedule_id = gm.schedule_id AND ga.assistant_id = gm.assistant_id
        LEFT JOIN public.users stu ON gm.student_id = stu.id
        WHERE ga.assistant_id = p_viewer_id;
    END IF;
END; $$;

-- 3. GRANTS
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
