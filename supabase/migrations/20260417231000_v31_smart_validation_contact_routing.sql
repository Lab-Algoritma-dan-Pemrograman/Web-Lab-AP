-- =====================================================
-- Migration: SMART VALIDATION ROUTING (V31)
-- Purpose: Route permission proofs directly to validation assistants
-- Resolve: "logika mengirim bukti dari praktikan itu diambil dari nomor asisten yang memiliki akses ke halaman validasi absensi"
-- =====================================================

-- 1. CREATE SMART CONTACT RPC
CREATE OR REPLACE FUNCTION public.get_smart_validation_contact_secure(p_student_id BIGINT)
RETURNS TABLE (
    phone_number TEXT,
    assistant_code TEXT,
    contact_type TEXT -- For debugging: 'assigned_validator', 'global_validator', or 'coordinator'
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- STEP 1: Try to find an assistant assigned to this student who ALREADY has validation rights
    RETURN QUERY
    SELECT u.phone_number::TEXT, u.assistant_code::TEXT, 'assigned_validator'::TEXT
    FROM public.users u
    JOIN public.group_members gm ON u.id = gm.assistant_id
    JOIN public.division_access da ON u.division = da.division
    WHERE gm.student_id = p_student_id 
      AND da.menu_key = '/validasi-absensi'
      AND u.is_active = true
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- STEP 2: If no assigned assistant has rights, find ANY assistant who has validation rights
    RETURN QUERY
    SELECT u.phone_number::TEXT, u.assistant_code::TEXT, 'global_validator'::TEXT
    FROM public.users u
    JOIN public.division_access da ON u.division = da.division
    WHERE u.role = 'asisten'
      AND da.menu_key = '/validasi-absensi'
      AND u.is_active = true
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- STEP 3: Fallback to Coordinator
    RETURN QUERY
    SELECT u.phone_number::TEXT, u.assistant_code::TEXT, 'coordinator'::TEXT
    FROM public.users u
    WHERE u.role = 'koordinator'
      AND u.is_active = true
    LIMIT 1;
END; $$;

-- 2. GRANTS
GRANT ALL ON FUNCTION public.get_smart_validation_contact_secure(BIGINT) TO authenticated, service_role, anon;
