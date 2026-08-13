-- =========================================================================
-- Migration: Add WhatsApp Gateway API Token & Provider Settings
-- Date: 2026-08-13
-- =========================================================================

ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS wa_gateway_provider TEXT DEFAULT 'fonnte',
ADD COLUMN IF NOT EXISTS wa_gateway_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS wa_auto_notify_enabled BOOLEAN DEFAULT true;

-- Update RPC function admin_update_global_settings_secure
CREATE OR REPLACE FUNCTION public.admin_update_global_settings_secure(
    p_caller_id BIGINT,
    p_semester_active TEXT,
    p_announcement TEXT,
    p_is_recruitment_open BOOLEAN,
    p_wa_templates JSONB DEFAULT NULL,
    p_recruitment_link TEXT DEFAULT NULL,
    p_login_guide_text TEXT DEFAULT NULL,
    p_procedure_text JSONB DEFAULT NULL,
    p_reschedule_steps TEXT DEFAULT NULL,
    p_wa_gateway_provider TEXT DEFAULT 'fonnte',
    p_wa_gateway_token TEXT DEFAULT NULL,
    p_wa_auto_notify_enabled BOOLEAN DEFAULT true
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_caller_role TEXT;
    v_target_id BIGINT;
BEGIN
    SELECT LOWER(role) INTO v_caller_role FROM public.users WHERE id = p_caller_id;
    IF v_caller_role IS NULL OR v_caller_role != 'koordinator' THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya koordinator yang diizinkan memperbarui pengaturan.';
    END IF;

    SELECT id INTO v_target_id FROM public.system_settings LIMIT 1;

    IF v_target_id IS NULL THEN
        INSERT INTO public.system_settings (
            semester_active, announcement, is_recruitment_open, 
            wa_templates, recruitment_link, login_guide_text, procedure_text, reschedule_steps,
            wa_gateway_provider, wa_gateway_token, wa_auto_notify_enabled, updated_at
        ) VALUES (
            p_semester_active, p_announcement, p_is_recruitment_open, 
            p_wa_templates, p_recruitment_link, p_login_guide_text, p_procedure_text, p_reschedule_steps,
            p_wa_gateway_provider, p_wa_gateway_token, p_wa_auto_notify_enabled, now()
        );
    ELSE
        UPDATE public.system_settings SET
            semester_active = p_semester_active,
            announcement = p_announcement,
            is_recruitment_open = p_is_recruitment_open,
            wa_templates = COALESCE(p_wa_templates, wa_templates),
            recruitment_link = COALESCE(p_recruitment_link, recruitment_link),
            login_guide_text = COALESCE(p_login_guide_text, login_guide_text),
            procedure_text = COALESCE(p_procedure_text, procedure_text),
            reschedule_steps = COALESCE(p_reschedule_steps, reschedule_steps),
            wa_gateway_provider = COALESCE(p_wa_gateway_provider, wa_gateway_provider),
            wa_gateway_token = COALESCE(p_wa_gateway_token, wa_gateway_token),
            wa_auto_notify_enabled = COALESCE(p_wa_auto_notify_enabled, wa_auto_notify_enabled),
            updated_at = now()
        WHERE id = v_target_id;
    END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_update_global_settings_secure TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
