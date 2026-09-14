-- Migration: Include student_class_code in get_group_members_secure RPC
DROP FUNCTION IF EXISTS public.get_group_members_secure(BIGINT, BIGINT);

CREATE OR REPLACE FUNCTION public.get_group_members_secure(p_viewer_id BIGINT, p_schedule_id BIGINT)
RETURNS TABLE (
    id BIGINT, 
    schedule_id BIGINT, 
    student_id BIGINT, 
    assistant_id BIGINT, 
    student_name TEXT, 
    student_nim TEXT, 
    assistant_name TEXT,
    student_shift TEXT,
    student_class_code TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT 
        gm.id::BIGINT, 
        gm.schedule_id::BIGINT, 
        gm.student_id::BIGINT, 
        gm.assistant_id::BIGINT, 
        u_s.full_name::TEXT, 
        u_s.username::TEXT, 
        u_a.full_name::TEXT,
        COALESCE(u_s.shift, '1')::TEXT,
        u_s.class_code::TEXT
    FROM public.group_members gm 
    JOIN public.users u_s ON gm.student_id = u_s.id 
    LEFT JOIN public.users u_a ON gm.assistant_id = u_a.id
    WHERE (p_schedule_id IS NULL OR gm.schedule_id = p_schedule_id)
      AND (public.is_staff(p_viewer_id) OR gm.student_id = p_viewer_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_group_members_secure(BIGINT, BIGINT) TO anon, authenticated, service_role;
