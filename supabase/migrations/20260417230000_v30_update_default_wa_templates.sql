-- =====================================================
-- Migration: SMART WA TEMPLATES (V30)
-- Purpose: Set default templates as requested by user
-- Resolve: Add V2 contact RPC to support honorifics
-- =====================================================

-- 1. UPGRADE ASSISTANT CONTACT RPC
CREATE OR REPLACE FUNCTION public.get_assistant_contact_v2_secure(p_caller_id BIGINT)
RETURNS TABLE (
    phone_number TEXT,
    assistant_code TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT u.phone_number::TEXT, u.assistant_code::TEXT
    FROM public.users u
    JOIN public.group_members gm ON u.id = gm.assistant_id
    WHERE gm.student_id = p_caller_id
    LIMIT 1;
END; $$;

-- 2. UPDATE DEFAULT TEMPLATES
-- Note: We use the user's wording but with our smart placeholders {{waktu}} and {{panggilan}}
UPDATE public.system_settings
SET wa_templates = jsonb_build_object(
    'absen_izin', 'Selamat {{waktu}} {{panggilan}}, saya {{nama}} ({{nim}}) dari kelas {{kelas}} {{jurusan}} ingin mengirimkan bukti izin: {{alasan}}',
    'asisten_swap', 'Selamat {{waktu}} mas, saya {{nama}} ingin mengajukan swap untuk jadwal {{jadwal}}. Alasan: {{alasan}}',
    'chat_asisten', 'Selamat {{waktu}} {{panggilan}} {{nama_asisten}}, saya {{nama_praktikan}} dengan NIM {{nim}} dari jurusan {{jurusan}} kelas {{kelas}}.'
)
WHERE id = 1;

-- 3. GRANTS
GRANT ALL ON FUNCTION public.get_assistant_contact_v2_secure(BIGINT) TO authenticated, service_role, anon;
