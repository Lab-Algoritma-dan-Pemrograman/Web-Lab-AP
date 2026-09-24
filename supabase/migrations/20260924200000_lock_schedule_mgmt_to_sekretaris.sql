-- =====================================================
-- LOCK MANAJEMEN JADWAL: hanya koordinator + sekretaris
-- =====================================================
-- Masalah:
--  - upsert_schedule_secure digate is_staff => SEMUA asisten (semua divisi)
--    bisa tambah/edit/hapus jadwal, termasuk kirim p_status='approved'
--    langsung (melewati mekanisme ACC yang cuma ada di frontend).
--  - delete_schedule_secure digate is_admin (role saja) => sekretaris
--    (role 'asisten', division 'SEKRETARIS') DITOLAK, padahal UI
--    menampilkan tombol hapus untuk mereka.
--
-- Solusi: satu helper is_schedule_manager() yang mengenali
-- role koordinator ATAU division sekretaris (kolom division/divisi),
-- dipakai di kedua fungsi. p_status dipaksa di server:
-- non-manager selalu 'pending' (tapi non-manager sekarang ditolak total).

-- 1. Helper baru
CREATE OR REPLACE FUNCTION public.is_schedule_manager(p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_user_id
          AND COALESCE(is_active, is_aktif, true) = true
          AND (
              role IN ('koordinator', 'sekretaris')
              OR lower(COALESCE(division, divisi, '')) = 'sekretaris'
          )
    );
END; $$;

-- 2. upsert_schedule_secure: gerbang is_schedule_manager (bukan is_staff)
CREATE OR REPLACE FUNCTION public.upsert_schedule_secure(
    p_caller_id BIGINT,
    p_id BIGINT,
    p_day_of_week TEXT,
    p_start_time TIME,
    p_end_time TIME,
    p_title TEXT,
    p_major TEXT,
    p_class_code TEXT,
    p_type TEXT DEFAULT 'praktikum',
    p_status TEXT DEFAULT 'approved'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_action TEXT;
BEGIN
    IF NOT public.is_schedule_manager(p_caller_id) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya koordinator atau sekretaris yang dapat mengelola jadwal.';
    END IF;

    IF p_id IS NULL OR p_id = 0 THEN
        INSERT INTO public.schedules (day_of_week, start_time, end_time, title, major, class_code, type, status)
        VALUES (p_day_of_week, p_start_time, p_end_time, p_title, p_major, p_class_code, p_type, p_status);
        v_action := 'Membuat jadwal baru: ' || p_title || ' (' || p_class_code || ')';
    ELSE
        UPDATE public.schedules SET
            day_of_week = p_day_of_week, start_time = p_start_time, end_time = p_end_time,
            title = p_title, major = p_major, class_code = p_class_code, type = p_type,
            status = p_status, updated_at = NOW()
        WHERE id = p_id;
        v_action := 'Mengubah jadwal ID ' || p_id::TEXT || ': ' || p_title;
    END IF;

    PERFORM public.log_activity(
        p_caller_id,
        'SCHEDULE_MANAGEMENT',
        v_action,
        jsonb_build_object('day_of_week', p_day_of_week, 'title', p_title, 'class_code', p_class_code)
    );
END; $$;

-- 3. delete_schedule_secure: gerbang is_schedule_manager (bukan is_admin)
CREATE OR REPLACE FUNCTION public.delete_schedule_secure(p_caller_id BIGINT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_title TEXT;
BEGIN
    IF NOT public.is_schedule_manager(p_caller_id) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya koordinator atau sekretaris yang dapat menghapus jadwal.';
    END IF;

    SELECT title INTO v_title FROM public.schedules WHERE id = p_id;

    DELETE FROM public.schedules WHERE id = p_id;

    PERFORM public.log_activity(
        p_caller_id,
        'DELETE_SCHEDULE',
        'Menghapus jadwal: ' || COALESCE(v_title, 'ID ' || p_id::TEXT),
        jsonb_build_object('schedule_id', p_id, 'title', v_title)
    );
END; $$;
