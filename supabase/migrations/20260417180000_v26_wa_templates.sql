-- =====================================================
-- Migration: ADD WA TEMPLATES (V26)
-- Purpose: Allow coordinators to manage dynamic WhatsApp templates
-- =====================================================

-- 1. SCHEMA UPDATE
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS wa_templates JSONB DEFAULT '{
  "absen_izin": "Halo Kak, saya {{nama}} ({{nim}}) dari kelas {{kelas}} {{jurusan}} ingin mengirimkan bukti izin: {{alasan}}",
  "asisten_swap": "Halo Koordinator, saya {{nama}} ingin mengajukan swap untuk jadwal {{jadwal}}. Alasan: {{alasan}}",
  "chat_asisten": "Halo Kak {{nama_asisten}}, saya {{nama_praktikan}} dari kelas {{kelas}}."
}'::jsonb;

-- 2. DROP OLD FUNCTIONS (to handle signature change)
DROP FUNCTION IF EXISTS public.get_system_settings_full_secure(BIGINT);
DROP FUNCTION IF EXISTS public.admin_update_global_settings_secure(BIGINT, TEXT, TEXT, BOOLEAN);

-- 3. RECREATE FUNCTIONS WITH WA_TEMPLATES
CREATE OR REPLACE FUNCTION public.get_system_settings_full_secure(p_viewer_id BIGINT)
RETURNS TABLE (semester_active TEXT, announcement TEXT, is_recruitment_open BOOLEAN, wa_templates JSONB) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer_id AND role IN ('koordinator', 'sekretaris')) THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF;
    RETURN QUERY SELECT ss.semester_active, ss.announcement, ss.is_recruitment_open, ss.wa_templates FROM public.system_settings ss LIMIT 1;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_global_settings_secure(
    p_caller_id BIGINT, 
    p_semester_active TEXT, 
    p_announcement TEXT, 
    p_is_recruitment_open BOOLEAN, 
    p_wa_templates JSONB DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_id AND role = 'koordinator') THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF;
    
    UPDATE public.system_settings SET 
        semester_active = p_semester_active, 
        announcement = p_announcement, 
        is_recruitment_open = p_is_recruitment_open, 
        wa_templates = COALESCE(p_wa_templates, wa_templates),
        updated_at = now() 
    WHERE id = (SELECT id FROM public.system_settings LIMIT 1);
END; $$;
