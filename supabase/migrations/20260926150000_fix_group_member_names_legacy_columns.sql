-- =========================================================================
-- Migration: Pulihkan nama anggota kelompok yang tampil "Nama tidak ditemukan"
--
-- Masalah: tabel public.users punya DUA ejaan kolom — kanonik (full_name,
--   username) dan lama (nama, nim). Sebagian baris hanya terisi di kolom lama,
--   sehingga `full_name`/`username` NULL. get_group_members_secure membaca
--   kolom kanonik saja, jadi baris itu muncul tanpa nama di Pilih Asisten
--   (produksi: 4 baris — 3 di TSE B, 1 di TSE C). Karena `username` ikut NULL,
--   akun-akun itu juga tidak bisa login.
--
-- Solusi:
--   1. Salin nilai kolom lama ke kolom kanonik bila kolom kanonik masih kosong.
--   2. Buat get_group_members_secure membaca kedua ejaan (COALESCE), supaya
--      impor berikutnya yang mengisi kolom lama tidak mengulang masalah ini.
--
-- Dijaga information_schema: DB tanpa kolom lama (mis. salinan lokal yang
--   tertinggal) tetap bisa menjalankan migrasi ini tanpa error.
-- =========================================================================

DO $mig$
DECLARE
    v_has_legacy BOOLEAN;
    v_student_expr TEXT;
    v_nim_expr TEXT;
    v_assistant_expr TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'nama'
    ) INTO v_has_legacy;

    IF v_has_legacy THEN
        -- 1. Akar masalah: isi kolom kanonik dari kolom lama yang terisi.
        EXECUTE 'UPDATE public.users SET full_name = nama WHERE full_name IS NULL AND nama IS NOT NULL';
        EXECUTE 'UPDATE public.users SET username  = nim  WHERE username  IS NULL AND nim  IS NOT NULL';
        v_student_expr   := 'COALESCE(u_s.full_name, u_s.nama)';
        v_nim_expr       := 'COALESCE(u_s.username, u_s.nim, u_s.id::TEXT)';
        v_assistant_expr := 'COALESCE(u_a.full_name, u_a.nama)';
    ELSE
        v_student_expr   := 'u_s.full_name';
        v_nim_expr       := 'u_s.username';
        v_assistant_expr := 'u_a.full_name';
    END IF;

    -- 2. RPC tahan terhadap kedua ejaan kolom.
    EXECUTE format($ddl$
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
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
    RETURN QUERY SELECT
        gm.id::BIGINT,
        gm.schedule_id::BIGINT,
        gm.student_id::BIGINT,
        gm.assistant_id::BIGINT,
        %s::TEXT,
        %s::TEXT,
        %s::TEXT,
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
END; $fn$;
$ddl$, v_student_expr, v_nim_expr, v_assistant_expr);
END $mig$;

GRANT EXECUTE ON FUNCTION public.get_group_members_secure(BIGINT, BIGINT) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';

-- Verifikasi: kolom kanonik sudah terisi (langkah 1 menyalin dari kolom lama
-- bila ada), jadi pemeriksaan di bawah berlaku untuk kedua bentuk skema.
-- Harus 0 baris.
SELECT gm.id, gm.schedule_id, gm.student_id, u_s.full_name, u_s.username
FROM public.group_members gm
JOIN public.users u_s ON gm.student_id = u_s.id
WHERE u_s.full_name IS NULL
   OR u_s.username IS NULL;
