-- =========================================================================
-- Migration: ENFORCE SCHEDULE VALIDATION IN DATABASE (H-3)
-- Date: 2026-06-22
-- Purpose: Validasi hari jadwal praktikum dipindah ke dalam fungsi DB
--          sehingga tidak bisa di-bypass dari client.
--
-- Sebelumnya validasi hanya ada di frontend (Absensi.tsx), sehingga user
-- bisa mengirim request langsung ke /api/rpc dan absen di hari yang bukan
-- jadwalnya.
-- =========================================================================

-- Buat ulang upsert_attendance_log_secure dengan validasi jadwal server-side
DROP FUNCTION IF EXISTS public.upsert_attendance_log_secure(BIGINT, BIGINT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT, TEXT, BIGINT);
DROP FUNCTION IF EXISTS public.upsert_attendance_log_secure(BIGINT, BIGINT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT, BIGINT, BIGINT);

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

GRANT EXECUTE ON FUNCTION public.upsert_attendance_log_secure(BIGINT, BIGINT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT, TEXT, BIGINT) TO service_role;
