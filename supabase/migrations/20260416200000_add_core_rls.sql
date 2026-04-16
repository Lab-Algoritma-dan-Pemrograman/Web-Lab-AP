-- =====================================================
-- Migration: Add Row Level Security (RLS) to Core Tables
-- Date: 2026-04-16
--
-- STRATEGY: Custom auth (no auth.uid()) → Use SECURITY DEFINER
-- RPCs to bypass RLS for writes. Lock direct anon access.
--
-- Tables secured: users, system_settings, division_access
-- Operational tables (attendance, schedule, etc.) left open.
-- =====================================================


-- ==========================================
-- STEP 1: ENABLE RLS ON CRITICAL TABLES
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.division_access ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- STEP 2: POLICIES FOR 'users' TABLE
-- anon can SELECT (required for login RPC + auth validation)
-- Direct INSERT/UPDATE/DELETE blocked → must use RPCs
-- ==========================================

DROP POLICY IF EXISTS "anon can read users" ON public.users;
CREATE POLICY "anon can read users"
    ON public.users FOR SELECT
    TO anon
    USING (true);


-- ==========================================
-- STEP 3: POLICIES FOR 'system_settings' TABLE
-- anon can SELECT (needed for login page announcements)
-- All writes go through RPC
-- ==========================================

DROP POLICY IF EXISTS "anon can read system_settings" ON public.system_settings;
CREATE POLICY "anon can read system_settings"
    ON public.system_settings FOR SELECT
    TO anon
    USING (true);


-- ==========================================
-- STEP 4: POLICIES FOR 'division_access' TABLE
-- anon can SELECT (needed to load user permissions in auth.tsx)
-- All writes go through RPC
-- ==========================================

DROP POLICY IF EXISTS "anon can read division_access" ON public.division_access;
CREATE POLICY "anon can read division_access"
    ON public.division_access FOR SELECT
    TO anon
    USING (true);


-- ==========================================
-- STEP 5: RPC — admin_update_user
-- Replaces direct: supabase.from('users').update(...)
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_update_user(
    p_id            INTEGER,
    p_username      TEXT,
    p_full_name     TEXT,
    p_phone_number  TEXT,
    p_role          TEXT,
    p_is_active     BOOLEAN,
    p_shift         TEXT,
    p_nim           TEXT,
    p_class_code    TEXT,
    p_division      TEXT,
    p_assistant_code TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.users SET
        username         = p_username,
        full_name        = p_full_name,
        phone_number     = p_phone_number,
        role             = p_role,
        is_active        = p_is_active,
        shift            = p_shift,
        nim              = p_nim,
        class_code       = p_class_code,
        division         = p_division,
        assistant_code   = p_assistant_code
    WHERE id = p_id;
END;
$$;


-- ==========================================
-- STEP 6: RPC — admin_toggle_user_status
-- Replaces direct: supabase.from('users').update({ is_active })
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_toggle_user_status(
    p_id        INTEGER,
    p_is_active BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.users
    SET is_active = p_is_active
    WHERE id = p_id;
END;
$$;


-- ==========================================
-- STEP 7: RPC — admin_delete_user
-- Replaces the multi-table cascade delete pattern
-- Handles all related data cleanup in one atomic operation
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Hapus data relasional terlebih dahulu
    DELETE FROM public.attendance_logs     WHERE custom_user_id = p_id;
    DELETE FROM public.feedback            WHERE custom_user_id = p_id;
    DELETE FROM public.group_members       WHERE student_id = p_id OR assistant_id = p_id;
    DELETE FROM public.group_assistants    WHERE assistant_id = p_id;
    DELETE FROM public.schedule_assignments WHERE user_id = p_id;
    DELETE FROM public.assistant_availability WHERE user_id = p_id;
    
    -- Terakhir hapus user utama
    DELETE FROM public.users WHERE id = p_id;
END;
$$;


-- ==========================================
-- STEP 8: RPC — admin_update_system_setting
-- Replaces direct: supabase.from('system_settings').update(...)
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_update_system_setting(
    p_active_shift TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.system_settings
    SET active_shift = p_active_shift
    WHERE id = 1;
END;
$$;


-- ==========================================
-- STEP 9: RPC — admin_save_division_access
-- Replaces: delete + insert pattern on division_access
-- Atomic: delete old then insert new in single transaction
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_save_division_access(
    p_division   TEXT,
    p_menu_keys  TEXT[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Hapus semua akses lama untuk divisi ini
    DELETE FROM public.division_access WHERE division = p_division;
    
    -- Insert akses baru jika ada
    IF p_menu_keys IS NOT NULL AND array_length(p_menu_keys, 1) > 0 THEN
        INSERT INTO public.division_access (division, menu_key)
        SELECT p_division, unnest(p_menu_keys);
    END IF;
END;
$$;
