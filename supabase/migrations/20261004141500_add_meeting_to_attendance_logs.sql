-- =========================================================================
-- Migration: PERTEMUAN PADA LOG ABSENSI (untuk sinkronisasi spreadsheet)
-- Date: 2026-10-04
-- Purpose:
--   1. Tambah kolom attendance_logs.meeting — menyimpan pertemuan mana yang
--      sedang di-absen (Pengarahan / Praktikum Modul 1 / ... / Ujian Praktik).
--      Absen manual oleh asisten (type 'staff_manual') sebelumnya tidak punya
--      penanda pertemuan sama sekali, sehingga rekap spreadsheet tidak bisa
--      tahu absen itu milik kolom mana.
--   2. Re-create upsert_attendance_log_secure dengan parameter p_meeting.
--      Semua overload lama di-drop dulu (pola dari 20260812140000) supaya
--      PostgREST tidak bingung memilih kandidat fungsi.
-- Catatan: parameter baru diberi DEFAULT NULL, jadi pemanggil lama tetap jalan.
-- =========================================================================

BEGIN;

-- ── 1. Kolom pertemuan ───────────────────────────────────────────────────
ALTER TABLE public.attendance_logs
    ADD COLUMN IF NOT EXISTS meeting TEXT;

COMMENT ON COLUMN public.attendance_logs.meeting IS
    'Label pertemuan: Pengarahan | Praktikum Modul 1 | Modul 2 | Modul 3&4 | Modul 5 | Modul 6 | Ujian Praktik';

-- ── 2. Drop SEMUA overload lama (dari pg_proc, aman walau signature berubah) ─
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'upsert_attendance_log_secure'
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig;
    END LOOP;
END $$;

-- ── 3. Versi kanonik + p_meeting ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_attendance_log_secure(
    p_caller_id       BIGINT,
    p_target_user_id  BIGINT,
    p_status          TEXT,
    p_notes           TEXT,
    p_check_in        TIMESTAMPTZ,
    p_is_verified     BOOLEAN,
    p_type            TEXT,           -- 'scan' | 'izin' | 'staff_manual' | 'reschedule'
    p_session_id      TEXT    DEFAULT NULL,
    p_schedule_id     BIGINT  DEFAULT NULL,
    p_meeting         TEXT    DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_check_date     DATE;
    v_check_day_num  INTEGER;
    v_day_names      TEXT[] := ARRAY['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    v_check_day_name TEXT;
    v_has_schedule   BOOLEAN := false;
    v_meeting        TEXT    := NULLIF(BTRIM(COALESCE(p_meeting, '')), '');
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
        session_id,
        meeting
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
        CASE WHEN p_session_id IS NOT NULL THEN p_session_id::UUID ELSE NULL END,
        v_meeting
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
            'meeting', v_meeting,
            'check_in', p_check_in
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_attendance_log_secure(
    BIGINT, BIGINT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT, TEXT, BIGINT, TEXT
) TO anon, authenticated, service_role;

COMMIT;
