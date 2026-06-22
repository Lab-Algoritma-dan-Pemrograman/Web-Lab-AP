-- Migration to add recruitment_link to system_settings and update global settings RPCs

-- 1. Add recruitment_link column
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS recruitment_link TEXT DEFAULT 'https://bit.ly/OprecAsistenLabAP';

-- 2. Update get_public_settings RPC
DROP FUNCTION IF EXISTS public.get_public_settings();
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE (
    announcement TEXT,
    is_recruitment_open BOOLEAN,
    active_shift TEXT,
    recruitment_link TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT ss.announcement, ss.is_recruitment_open, ss.active_shift, ss.recruitment_link FROM public.system_settings ss LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;

-- 3. Update get_system_settings_full_secure RPC (re-include wa_templates and add recruitment_link)
DROP FUNCTION IF EXISTS public.get_system_settings_full_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_system_settings_full_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    semester_active TEXT,
    announcement TEXT,
    is_recruitment_open BOOLEAN,
    active_shift TEXT,
    updated_at TIMESTAMPTZ,
    wa_templates JSONB,
    recruitment_link TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    RETURN QUERY 
    SELECT ss.id, ss.semester_active, ss.announcement, ss.is_recruitment_open, ss.active_shift, ss.updated_at, ss.wa_templates, ss.recruitment_link
    FROM public.system_settings ss 
    LIMIT 1;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_system_settings_full_secure(BIGINT) TO authenticated;

-- 4. Update admin_update_global_settings_secure RPC (support both wa_templates and recruitment_link)
DROP FUNCTION IF EXISTS public.admin_update_global_settings_secure(BIGINT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_update_global_settings_secure(BIGINT, TEXT, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.admin_update_global_settings_secure(BIGINT, TEXT, TEXT, BOOLEAN, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.admin_update_global_settings_secure(
    p_caller_id BIGINT,
    p_semester_active TEXT,
    p_announcement TEXT,
    p_is_recruitment_open BOOLEAN,
    p_wa_templates JSONB DEFAULT NULL,
    p_recruitment_link TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    UPDATE public.system_settings SET 
        semester_active = p_semester_active,
        announcement = p_announcement,
        is_recruitment_open = p_is_recruitment_open,
        wa_templates = COALESCE(p_wa_templates, wa_templates),
        recruitment_link = COALESCE(p_recruitment_link, recruitment_link),
        updated_at = NOW();
    
    IF NOT FOUND THEN
        INSERT INTO public.system_settings (semester_active, announcement, is_recruitment_open, wa_templates, recruitment_link) 
        VALUES (p_semester_active, p_announcement, p_is_recruitment_open, p_wa_templates, p_recruitment_link);
    END IF;

    PERFORM public.log_activity(
        p_caller_id, 
        'SYSTEM_SETTINGS', 
        'Mengubah pengaturan global (Semester: ' || p_semester_active || ')', 
        jsonb_build_object(
            'semester_active', p_semester_active, 
            'announcement', p_announcement, 
            'is_recruitment_open', p_is_recruitment_open,
            'recruitment_link', p_recruitment_link
        )
    );
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_global_settings_secure(BIGINT, TEXT, TEXT, BOOLEAN, JSONB, TEXT) TO authenticated;
