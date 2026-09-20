-- =========================================================================
-- Migration: Auto Sync Student Group Membership on Class Change
-- Masalah: Ketika praktikan diubah kelasnya (misal dari E ke C) di Manajemen User,
--          data di tabel users berubah tapi relasi di tabel group_members masih
--          terikat ke schedule kelas lama (Kelas E), sehingga praktikan tetap muncul
--          di kelas lama pada menu Pilih Asisten (Manajemen Kelas).
-- Solusi:
--   1. Bersihkan data group_members yang kelas/jurusannya sudah tidak sinkron saat ini.
--   2. Perbarui admin_update_user: otomatis lepas relasi kelas lama dan hubungkan
--      ke kelas baru saat class_code praktikan diubah.
--   3. Perbarui sync_students_to_group_secure: bersihkan mahasiswa yang sudah pindah kelas
--      saat tombol "Sync Data Mahasiswa" ditekan.
--   4. Perbarui get_group_members_secure: filter agar mahasiswa yang sudah beda kelas
--      tidak pernah bocor/tampil di kelas lama.
-- =========================================================================

-- STEP 1: Bersihkan relasi group_members yang tidak sesuai dengan kelas praktikan saat ini
DELETE FROM public.group_members gm
USING public.users u, public.schedules s
WHERE gm.student_id = u.id
  AND gm.schedule_id = s.id
  AND u.role = 'praktikan'
  AND (
    COALESCE(u.class_code, '') != COALESCE(s.class_code, '')
    OR NOT public.majors_match(u.major, u.nim, u.division, s.major)
  );

-- Masukkan mahasiswa yang aktif ke jadwal kelas barunya jika jadwalnya tersedia
INSERT INTO public.group_members (schedule_id, student_id)
SELECT s.id, u.id
FROM public.users u
JOIN public.schedules s 
  ON s.type = 'praktikum'
 AND s.status = 'approved'
 AND COALESCE(u.class_code, '') = COALESCE(s.class_code, '')
 AND public.majors_match(u.major, u.nim, u.division, s.major)
WHERE u.role = 'praktikan'
  AND u.class_code IS NOT NULL
  AND trim(u.class_code) != ''
ON CONFLICT (schedule_id, student_id) DO NOTHING;


-- STEP 2: Update admin_update_user agar otomatis menangani perubahan kelas praktikan
CREATE OR REPLACE FUNCTION public.admin_update_user(
    p_caller_id     BIGINT,
    p_target_id     BIGINT,
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
SET search_path = public, extensions 
AS $$
DECLARE
    v_old_name TEXT;
    v_old_class_code TEXT;
    v_old_nim TEXT;
    v_old_division TEXT;
    v_target_major TEXT;
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only Koordinator can perform this action';
    END IF;

    SELECT full_name, class_code, nim, division 
    INTO v_old_name, v_old_class_code, v_old_nim, v_old_division 
    FROM public.users WHERE id = p_target_id;

    v_target_major := COALESCE(public.get_major_from_nim(COALESCE(p_nim, v_old_nim)), p_division, v_old_division);

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
        assistant_code   = p_assistant_code,
        major            = v_target_major
    WHERE id = p_target_id;

    -- JIKA PRAKTIKAN BERUBAH KELAS / JURUSAN:
    IF p_role = 'praktikan' AND (
        COALESCE(p_class_code, '') IS DISTINCT FROM COALESCE(v_old_class_code, '')
    ) THEN
        -- 1. Hapus plotting lama dari jadwal kelas yang sudah tidak sesuai
        DELETE FROM public.group_members gm
        USING public.schedules s
        WHERE gm.schedule_id = s.id
          AND gm.student_id = p_target_id
          AND (
            COALESCE(s.class_code, '') != COALESCE(p_class_code, '')
            OR NOT public.majors_match(v_target_major, COALESCE(p_nim, v_old_nim), p_division, s.major)
          );

        -- 2. Otomatis hubungkan ke jadwal praktikum kelas barunya jika jadwal tersedia
        IF p_class_code IS NOT NULL AND trim(p_class_code) != '' THEN
            INSERT INTO public.group_members (schedule_id, student_id)
            SELECT s.id, p_target_id
            FROM public.schedules s
            WHERE s.type = 'praktikum'
              AND s.status = 'approved'
              AND s.class_code = p_class_code
              AND public.majors_match(v_target_major, COALESCE(p_nim, v_old_nim), p_division, s.major)
            ON CONFLICT (schedule_id, student_id) DO NOTHING;
        END IF;
    END IF;

    PERFORM public.log_activity(
        p_caller_id, 
        'USER_MANAGEMENT', 
        'Mengubah data user ' || COALESCE(v_old_name, 'ID ' || p_target_id::TEXT) || ' menjadi nama: "' || p_full_name || '", username: "' || p_username || '", role: "' || p_role || '"' || 
        CASE WHEN COALESCE(p_class_code, '') IS DISTINCT FROM COALESCE(v_old_class_code, '') 
             THEN ' (pindah kelas dari ' || COALESCE(v_old_class_code, '-') || ' ke ' || COALESCE(p_class_code, '-') || ')' 
             ELSE '' END, 
        jsonb_build_object(
            'target_id', p_target_id, 
            'username', p_username, 
            'full_name', p_full_name, 
            'role', p_role, 
            'is_active', p_is_active,
            'old_class_code', v_old_class_code,
            'new_class_code', p_class_code,
            'division', p_division,
            'assistant_code', p_assistant_code
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user(BIGINT, BIGINT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;


-- STEP 3: Update sync_students_to_group_secure agar otomatis membersihkan mahasiswa yang sudah pindah kelas
CREATE OR REPLACE FUNCTION public.sync_students_to_group_secure(
    p_caller_id BIGINT,
    p_schedule_id BIGINT,
    p_major TEXT,
    p_class_code TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sched_title TEXT;
    v_inserted INT;
    v_deleted INT;
BEGIN
    IF NOT public.is_staff(p_caller_id) THEN RAISE EXCEPTION 'Access Denied'; END IF;
    
    SELECT title INTO v_sched_title FROM public.schedules WHERE id = p_schedule_id;
    
    -- 1. Hapus mahasiswa yang sudah bukan anggota kelas/jurusan ini lagi
    DELETE FROM public.group_members gm
    USING public.users u
    WHERE gm.schedule_id = p_schedule_id
      AND gm.student_id = u.id
      AND (
        u.role != 'praktikan'
        OR COALESCE(u.class_code, '') != COALESCE(p_class_code, '')
        OR NOT public.majors_match(u.major, u.nim, u.division, p_major)
      );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- 2. Masukkan mahasiswa yang kelas dan jurusannya cocok
    INSERT INTO public.group_members (schedule_id, student_id)
    SELECT p_schedule_id, u.id FROM public.users u 
    WHERE u.role = 'praktikan' 
      AND u.class_code = p_class_code
      AND public.majors_match(u.major, u.nim, u.division, p_major)
    ON CONFLICT (schedule_id, student_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    PERFORM public.log_activity(
        p_caller_id, 
        'PLOT_SCHEDULE', 
        'Sinkronisasi praktikan jadwal ' || COALESCE(v_sched_title, 'ID ' || p_schedule_id::TEXT) || ' (' || p_major || ' - ' || p_class_code || '): +' || v_inserted::TEXT || ' ditambahkan, -' || v_deleted::TEXT || ' dibersihkan', 
        jsonb_build_object('schedule_id', p_schedule_id, 'major', p_major, 'class_code', p_class_code, 'synced_count', v_inserted, 'removed_count', v_deleted)
    );
END; $$;

GRANT EXECUTE ON FUNCTION public.sync_students_to_group_secure(BIGINT, BIGINT, TEXT, TEXT) TO authenticated, service_role;


-- STEP 4: Update get_group_members_secure dengan defensive filter kelas
CREATE OR REPLACE FUNCTION public.get_group_members_secure(p_viewer_id BIGINT, p_schedule_id BIGINT)
RETURNS TABLE (
    id BIGINT, 
    schedule_id BIGINT, 
    student_id BIGINT, 
    assistant_id BIGINT, 
    student_name TEXT, 
    student_nim TEXT, 
    assistant_name TEXT,
    student_shift TEXT,
    student_class_code TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT 
        gm.id::BIGINT, 
        gm.schedule_id::BIGINT, 
        gm.student_id::BIGINT, 
        gm.assistant_id::BIGINT, 
        u_s.full_name::TEXT, 
        u_s.username::TEXT, 
        u_a.full_name::TEXT,
        COALESCE(u_s.shift, '1')::TEXT,
        u_s.class_code::TEXT
    FROM public.group_members gm 
    JOIN public.users u_s ON gm.student_id = u_s.id 
    JOIN public.schedules s ON gm.schedule_id = s.id
    LEFT JOIN public.users u_a ON gm.assistant_id = u_a.id
    WHERE (p_schedule_id IS NULL OR gm.schedule_id = p_schedule_id)
      AND (p_schedule_id IS NULL OR COALESCE(u_s.class_code, '') = COALESCE(s.class_code, ''))
      AND (public.is_staff(p_viewer_id) OR gm.student_id = p_viewer_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_group_members_secure(BIGINT, BIGINT) TO anon, authenticated, service_role;
