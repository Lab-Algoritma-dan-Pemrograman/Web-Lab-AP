-- Migration: Update has_delete_attendance_access to allow assistants in sekretaris and k3 divisions to delete attendance logs
CREATE OR REPLACE FUNCTION public.has_delete_attendance_access(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role TEXT;
    v_code TEXT;
    v_active BOOLEAN;
    v_division TEXT;
BEGIN
    SELECT role, assistant_code, is_active, LOWER(COALESCE(division, ''))
    INTO v_role, v_code, v_active, v_division
    FROM public.users WHERE id = p_user_id;
    
    IF v_active IS NOT TRUE THEN
        RETURN FALSE;
    END IF;
    
    IF v_role IN ('koordinator', 'sekretaris', 'k3') THEN
        RETURN TRUE;
    ELSIF v_role = 'asisten' THEN
        -- Izinkan jika divisi berhak (sekretaris, k3) ATAU memiliki kode berakhiran K (Ketua/Koor)
        IF v_division IN ('sekretaris', 'k3') OR (v_code IS NOT NULL AND UPPER(v_code) LIKE '%K') THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END; $$;

GRANT EXECUTE ON FUNCTION public.has_delete_attendance_access(BIGINT) TO authenticated, service_role;
