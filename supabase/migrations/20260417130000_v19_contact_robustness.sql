-- =====================================================
-- Migration: CONTACT ROBUSTNESS REPAIR (V19)
-- Resolve: Broken WA Link (No redirection)
-- Resolve: Aggressive Staff Fallback Logic
-- =====================================================

-- 1. PURGE old signature to prevent conflict
DROP FUNCTION IF EXISTS public.get_assistant_contact_secure(BIGINT);

-- 2. RE-IMPLEMENT: Aggressive Contact Seeking
CREATE OR REPLACE FUNCTION public.get_assistant_contact_secure(p_caller_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_phone TEXT;
BEGIN
    -- Priority 1: Assistant with Validation Access
    SELECT u.phone_number INTO v_phone
    FROM public.users u
    JOIN public.division_access da ON u.division = da.division
    WHERE da.menu_key = '/validasi-absensi' 
      AND u.role = 'asisten' 
      AND u.phone_number IS NOT NULL 
      AND u.phone_number != ''
    LIMIT 1;

    -- Priority 2: Koordinator
    IF v_phone IS NULL OR v_phone = '' THEN
        SELECT u.phone_number INTO v_phone 
        FROM public.users u 
        WHERE u.role = 'koordinator' 
          AND u.phone_number IS NOT NULL 
          AND u.phone_number != ''
        LIMIT 1;
    END IF;

    -- Priority 3: ANY active Staff (Asisten, Sekretaris, K3) as absolute fallback
    IF v_phone IS NULL OR v_phone = '' THEN
        SELECT u.phone_number INTO v_phone 
        FROM public.users u 
        WHERE u.role IN ('asisten', 'sekretaris', 'k3') 
          AND u.phone_number IS NOT NULL 
          AND u.phone_number != ''
        ORDER BY u.role ASC -- Prioritize Asisten over others
        LIMIT 1;
    END IF;

    RETURN v_phone;
END; $$;

-- 3. GRANTS
GRANT ALL ON FUNCTION public.get_assistant_contact_secure TO authenticated, service_role, anon;
