-- Migration: Add get_audit_logs_rpc (20260622080000)
-- Description: Adds a secure RPC function to fetch audit logs for coordinators and secretary division.
-- Also auto-grants menu access to the Sekretaris division.

CREATE OR REPLACE FUNCTION public.get_audit_logs_secure(
    p_viewer_id BIGINT,
    p_search TEXT DEFAULT NULL,
    p_action_type TEXT DEFAULT NULL,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
) RETURNS TABLE (
    id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    actor_id BIGINT,
    actor_name TEXT,
    action_type TEXT,
    description TEXT,
    payload JSONB
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_viewer_id AND u.role = 'koordinator' AND u.is_active = true) OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_viewer_id AND u.role = 'asisten' AND UPPER(u.division) = 'SEKRETARIS' AND u.is_active = true)
    ) THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya Koordinator dan Sekretaris yang memiliki izin.';
    END IF;

    RETURN QUERY
    SELECT al.id, al.created_at, al.actor_id, al.actor_name, al.action_type, al.description, al.payload
    FROM public.audit_logs al
    WHERE 
        (p_action_type IS NULL OR p_action_type = '' OR al.action_type = p_action_type)
        AND (
            p_search IS NULL 
            OR p_search = ''
            OR al.actor_name ILIKE '%' || p_search || '%' 
            OR al.description ILIKE '%' || p_search || '%'
        )
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END; $$;

-- Insert default menu access for Sekretaris division
INSERT INTO public.division_access (division, menu_key)
SELECT 'SEKRETARIS', '/audit-log'
WHERE NOT EXISTS (
    SELECT 1 FROM public.division_access WHERE division = 'SEKRETARIS' AND menu_key = '/audit-log'
);
