-- =========================================================================
-- Migration: FIX QR TOKEN RACE CONDITION & TIMEZONE & CLEANUP OVERLOADS
-- Date: 2026-08-12
-- Purpose:
--   1. Add previous_token to qr_sessions for grace period during rotation
--   2. Update get_qr_session_secure to match token OR previous_token
--   3. Update update_qr_session_token_secure to save old token
--   4. Fix check_already_absent_secure timezone (CURRENT_DATE → WIB)
--   5. Drop all conflicting overloads of upsert_attendance_log_secure
-- =========================================================================

-- ── 1. Add previous_token column ──────────────────────────────────────────
ALTER TABLE public.qr_sessions 
ADD COLUMN IF NOT EXISTS previous_token TEXT DEFAULT NULL;

-- ── 2. Drop ALL overloaded versions dynamically from pg_proc ──────────────
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'upsert_attendance_log_secure', 
              'update_qr_session_token_secure', 
              'stop_qr_session_secure', 
              'get_qr_session_secure', 
              'check_already_absent_secure',
              'get_schedules_secure',
              'upsert_schedule_assignment_secure'
          )
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE;';
    END LOOP;
END $$;

-- ── 3. Create updated functions ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_qr_session_token_secure(
    p_caller_id BIGINT,
    p_id UUID,
    p_token TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;
    
    -- Save current token as previous before updating
    UPDATE public.qr_sessions 
    SET previous_token = token,
        token = p_token 
    WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stop_qr_session_secure(
    p_caller_id BIGINT,
    p_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;
    
    UPDATE public.qr_sessions 
    SET is_active = FALSE 
    WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_qr_session_secure(
    p_token TEXT
) RETURNS TABLE (id UUID, title TEXT, is_active BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY 
    SELECT qs.id, qs.title, qs.is_active
    FROM public.qr_sessions qs
    WHERE (qs.token = p_token OR qs.previous_token = p_token) 
      AND qs.is_active = true
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_already_absent_secure(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.attendance_logs 
        WHERE custom_user_id = p_user_id 
        AND (check_in_time AT TIME ZONE 'Asia/Jakarta')::DATE = (now() AT TIME ZONE 'Asia/Jakarta')::DATE
        AND status = 'Hadir'
    );
END;
$$;

-- ── 4. Re-create canonical upsert_attendance_log_secure ────────────────────
CREATE OR REPLACE FUNCTION public.upsert_attendance_log_secure(
    p_caller_id       BIGINT,
    p_target_user_id  BIGINT,
    p_status          TEXT,
    p_notes           TEXT,
    p_check_in        TIMESTAMPTZ,
    p_is_verified     BOOLEAN,
    p_type            TEXT,           -- 'scan' | 'izin' | 'staff_manual' | 'reschedule'
    p_session_id      TEXT    DEFAULT NULL,
    p_schedule_id     BIGINT  DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_check_date     DATE;
    v_check_day_num  INTEGER;
    v_day_names      TEXT[] := ARRAY['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    v_check_day_name TEXT;
    v_has_schedule   BOOLEAN := false;
BEGIN
    -- ── Validasi Hak Akses ─────────────────────────────────────────────────
    IF p_type IN ('scan', 'izin') THEN
        IF p_caller_id != p_target_user_id THEN
            RAISE EXCEPTION 'Akses Ditolak: Anda hanya dapat mengubah absensi sendiri.';
        END IF;
    ELSIF p_type = 'staff_manual' THEN
        IF NOT (public.is_staff(p_caller_id) OR public.is_pj_absen_today(p_caller_id)) THEN
            RAISE EXCEPTION 'Akses Ditolak: Hanya staf atau PJ Absen yang dapat input manual.';
        END IF;
    END IF;

    -- ── Validasi Jadwal untuk tipe 'scan' (server-side, tidak bisa di-bypass) ──
    IF p_type = 'scan' THEN
        v_check_date     := (p_check_in AT TIME ZONE 'Asia/Jakarta')::DATE;
        v_check_day_num  := EXTRACT(DOW FROM v_check_date)::INTEGER;
        v_check_day_name := v_day_names[v_check_day_num + 1];

        -- Cek jadwal reguler hari ini
        SELECT EXISTS (
            SELECT 1
            FROM public.group_members gm
            JOIN public.schedules s ON gm.schedule_id = s.id
            WHERE gm.student_id = p_target_user_id
              AND s.day_of_week  = v_check_day_name
              AND s.type         = 'praktikum'
        ) INTO v_has_schedule;

        -- Jika tidak ada jadwal reguler, cek reschedule yang disetujui
        IF NOT v_has_schedule THEN
            SELECT EXISTS (
                SELECT 1
                FROM public.attendance_logs al
                JOIN public.schedules s ON al.reschedule_schedule_id = s.id
                WHERE al.custom_user_id      = p_target_user_id
                  AND al.reschedule_status   = 'approved'
                  AND s.day_of_week          = v_check_day_name
            ) INTO v_has_schedule;
        END IF;

        IF NOT v_has_schedule THEN
            RAISE EXCEPTION
                'Gagal Absen: Anda tidak memiliki jadwal praktikum atau reschedule yang disetujui pada hari % ini.',
                v_check_day_name;
        END IF;

        -- Cek apakah sudah absen hari ini
        IF EXISTS (
            SELECT 1 FROM public.attendance_logs
            WHERE custom_user_id = p_target_user_id
              AND (check_in_time AT TIME ZONE 'Asia/Jakarta')::DATE = v_check_date
              AND status = 'Hadir'
        ) THEN
            RAISE EXCEPTION 'Anda sudah melakukan absensi hari ini.';
        END IF;
    END IF;

    -- ── Insert Log Absensi ─────────────────────────────────────────────────
    INSERT INTO public.attendance_logs (
        custom_user_id,
        status,
        notes,
        check_in_time,
        is_verified,
        verification_status,
        type,
        reschedule_schedule_id,
        recorded_by,
        session_id
    ) VALUES (
        p_target_user_id,
        p_status,
        p_notes,
        p_check_in,
        p_is_verified,
        CASE WHEN p_is_verified THEN 'approved' ELSE 'pending' END,
        p_type,
        p_schedule_id,
        p_caller_id,
        CASE WHEN p_session_id IS NOT NULL THEN p_session_id::UUID ELSE NULL END
    );

    -- ── Audit Log ─────────────────────────────────────────────────────────
    PERFORM public.log_activity(
        p_caller_id,
        'ATTENDANCE',
        'Absensi ' || p_type || ' untuk user ID ' || p_target_user_id || ' — status: ' || p_status,
        jsonb_build_object(
            'target_user_id', p_target_user_id,
            'status', p_status,
            'type', p_type,
            'check_in', p_check_in
        )
    );
END;
$$;

-- ── 5. Re-create get_schedules_secure (Allow Students & Staff) ────────────
CREATE OR REPLACE FUNCTION public.get_schedules_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id TEXT,
    title TEXT,
    major TEXT,
    class_code TEXT,
    day_of_week TEXT,
    start_time TIME,
    end_time TIME,
    type TEXT,
    status TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_viewer_id IS NULL OR p_viewer_id = 0 THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    RETURN QUERY 
    SELECT s.id::TEXT, s.title::TEXT, s.major::TEXT, s.class_code::TEXT, s.day_of_week::TEXT, s.start_time::TIME, s.end_time::TIME, s.type::TEXT, s.status::TEXT
    FROM public.schedules s
    ORDER BY s.day_of_week ASC, s.start_time ASC;
END; $$;

-- ── 6. Re-create upsert_schedule_assignment_secure (p_schedule_id BIGINT) ──
CREATE OR REPLACE FUNCTION public.upsert_schedule_assignment_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_schedule_id BIGINT,
    p_user_id BIGINT,
    p_task_role TEXT,
    p_activity_name TEXT,
    p_activity_date DATE
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_asst_name TEXT;
    v_sched_title TEXT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    SELECT full_name INTO v_asst_name FROM public.users WHERE id = p_user_id;
    SELECT title INTO v_sched_title FROM public.schedules WHERE id = p_schedule_id;

    IF p_id IS NULL OR p_id = 0 THEN
        INSERT INTO public.schedule_assignments (schedule_id, user_id, task_role, activity_name, activity_date, status)
        VALUES (p_schedule_id, p_user_id, p_task_role, p_activity_name, p_activity_date, 'aktif');
        
        PERFORM public.log_activity(
            p_caller_id, 
            'SCHEDULE_ASSIGNMENT', 
            'Menambahkan petugas ' || COALESCE(v_asst_name, '') || ' untuk jadwal ID ' || p_schedule_id,
            jsonb_build_object('schedule_id', p_schedule_id, 'user_id', p_user_id, 'task_role', p_task_role, 'activity_name', p_activity_name, 'activity_date', p_activity_date)
        );
    ELSE
        UPDATE public.schedule_assignments 
        SET schedule_id = p_schedule_id,
            user_id = p_user_id,
            task_role = p_task_role,
            activity_name = p_activity_name,
            activity_date = p_activity_date
        WHERE id = p_id;

        PERFORM public.log_activity(
            p_caller_id, 
            'SCHEDULE_ASSIGNMENT', 
            'Mengubah petugas ID ' || p_id || ' untuk jadwal ID ' || p_schedule_id,
            jsonb_build_object('id', p_id, 'schedule_id', p_schedule_id, 'user_id', p_user_id, 'task_role', p_task_role, 'activity_name', p_activity_name, 'activity_date', p_activity_date)
        );
    END IF;
END; $$;

-- ── 7. Grant permissions & Reload Schema Cache ───────────────────────────
GRANT EXECUTE ON FUNCTION public.update_qr_session_token_secure TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stop_qr_session_secure TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_qr_session_secure TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_already_absent_secure TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_attendance_log_secure TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_schedules_secure TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_schedule_assignment_secure TO authenticated, service_role;

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
