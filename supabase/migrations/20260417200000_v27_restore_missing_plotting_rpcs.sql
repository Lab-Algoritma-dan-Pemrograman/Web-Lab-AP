-- =====================================================
-- Migration: RESTORE MISSING PLOTTING RPCS (V27)
-- Purpose: Restore functions dropped in V12 but not recreated
-- Resolve: "Could not find function public.upsert_group_assistant_secure"
-- Resolve: "no unique or exclusion constraint matching ON CONFLICT"
-- =====================================================

-- 0. SCHEMA HARDENING: Ensure Unique Constraints exist for ON CONFLICT logic
DO $$ 
BEGIN 
    -- 1. Unique constraint for Group Assistants
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'group_assistants_schedule_id_assistant_id_key'
    ) THEN
        ALTER TABLE public.group_assistants 
        ADD CONSTRAINT group_assistants_schedule_id_assistant_id_key UNIQUE (schedule_id, assistant_id);
    END IF;

    -- 2. Unique constraint for Group Members (Required for sync_students_to_group_secure)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'group_members_schedule_id_student_id_key'
    ) THEN
        ALTER TABLE public.group_members 
        ADD CONSTRAINT group_members_schedule_id_student_id_key UNIQUE (schedule_id, student_id);
    END IF;
END $$;

-- 1. Restore upsert_group_assistant_secure
-- Uses BIGINT for p_schedule_id to match V12 standard
CREATE OR REPLACE FUNCTION public.upsert_group_assistant_secure(
    p_caller_id BIGINT, 
    p_schedule_id BIGINT, 
    p_assistant_id BIGINT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF;
    
    INSERT INTO public.group_assistants (schedule_id, assistant_id) 
    VALUES (p_schedule_id, p_assistant_id) 
    ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
END; $$;

-- 2. Restore delete_group_assistant_secure
CREATE OR REPLACE FUNCTION public.delete_group_assistant_secure(
    p_caller_id BIGINT, 
    p_id BIGINT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF;
    
    DELETE FROM public.group_assistants WHERE id = p_id;
END; $$;

-- 3. Restore update_group_members_batch_secure
CREATE OR REPLACE FUNCTION public.update_group_members_batch_secure(
    p_caller_id BIGINT, 
    p_updates JSONB
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item RECORD;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF;
    
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_updates) AS x(id BIGINT, assistant_id BIGINT)
    LOOP
        UPDATE public.group_members 
        SET assistant_id = v_item.assistant_id 
        WHERE id = v_item.id;
    END LOOP;
END; $$;

-- 4. Restore get_all_group_members_secure
CREATE OR REPLACE FUNCTION public.get_all_group_members_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT, 
    schedule_class_code TEXT, 
    schedule_major TEXT, 
    schedule_title TEXT, 
    schedule_day TEXT, 
    schedule_start TIME, 
    schedule_end TIME, 
    assistant_name TEXT, 
    student_name TEXT, 
    student_nim TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF;
    
    RETURN QUERY SELECT 
        gm.id::BIGINT, 
        s.class_code, 
        s.major, 
        s.title, 
        s.day_of_week, 
        s.start_time, 
        s.end_time, 
        u_a.full_name, 
        u_s.full_name, 
        u_s.username
    FROM public.group_members gm 
    JOIN public.schedules s ON gm.schedule_id = s.id 
    JOIN public.users u_s ON gm.student_id = u_s.id 
    LEFT JOIN public.users u_a ON gm.assistant_id = u_a.id;
END; $$;

-- 5. CONFIRM GRANTS
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
