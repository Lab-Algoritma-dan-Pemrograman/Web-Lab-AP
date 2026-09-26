-- =========================================================================
-- Migration: Perbaiki daftar anggota kelompok di halaman Jadwal Saya (praktikan)
--
-- Masalah 1 (utama): cabang non-staff get_group_members_secure memakai
--   `gm.student_id = p_viewer_id`, sehingga praktikan hanya menerima baris
--   dirinya sendiri. Halaman Jadwal Saya menyaring baris itu per assistant_id
--   untuk membentuk daftar "Kelompok Saya" -> hasilnya selalu 1 orang
--   (diri sendiri), jadi nama-nama teman sekelompok tidak pernah tampil.
--   api/rpc.ts juga menyuntik p_viewer_id dari JWT, jadi frontend tidak bisa
--   meminta data kelas lewat parameter.
--
-- Masalah 2: penyaring kelas membandingkan class_code mentah
--   (`u_s.class_code = s.class_code`). Formatnya beda antar tabel: users pakai
--   "TSE B"/"TE C", schedules pakai "B"/"C" -> 6 baris group_members yang sah
--   terbuang dari daftar.
--
-- Solusi:
--   - Scope non-staff diperluas ke seluruh anggota jadwal tempat pemanggil
--     terdaftar (teman sekelas). Isolasi tetap terjaga: praktikan hanya bisa
--     melihat kelasnya sendiri; staff tetap melihat semua.
--   - Tambah normalize_class_code()/classes_match() dan pakai di RPC.
--   - Kolom telepon tetap tidak dikembalikan sama sekali.
-- =========================================================================

-- 1. Helper perbandingan kelas yang toleran format ("TSE B" ~ "B", "S1-C" ~ "C")
CREATE OR REPLACE FUNCTION public.normalize_class_code(p_code TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
    SELECT upper(NULLIF(regexp_replace(COALESCE(p_code, ''), '^.*[-\s]', ''), ''))
$$;

CREATE OR REPLACE FUNCTION public.classes_match(p_user_class TEXT, p_schedule_class TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE SET search_path = public AS $$
    SELECT public.normalize_class_code(p_user_class) IS NOT NULL
       AND public.normalize_class_code(p_user_class) = public.normalize_class_code(p_schedule_class)
$$;

-- 2. Perluas scope anggota kelompok untuk praktikan
DROP FUNCTION IF EXISTS public.get_group_members_secure(BIGINT, BIGINT);

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
      AND (p_schedule_id IS NULL OR public.classes_match(u_s.class_code, s.class_code))
      AND (
        public.is_staff(p_viewer_id)
        OR gm.schedule_id IN (
            SELECT vg.schedule_id FROM public.group_members vg WHERE vg.student_id = p_viewer_id
        )
      );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_group_members_secure(BIGINT, BIGINT) TO anon, authenticated, service_role;
