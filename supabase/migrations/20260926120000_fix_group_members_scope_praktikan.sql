-- =========================================================================
-- Migration: daftar anggota kelompok di halaman Jadwal Saya (praktikan)
--
-- Masalah: cabang non-staff get_group_members_secure memakai
--   `gm.student_id = p_viewer_id`, sehingga praktikan hanya menerima baris
--   dirinya sendiri. Halaman Jadwal Saya menyaring baris itu untuk membentuk
--   daftar "Kelompok Saya" -> hasilnya selalu 1 orang (diri sendiri).
--   api/rpc.ts juga menyuntik p_viewer_id dari JWT, jadi frontend tidak bisa
--   meminta data kelas lewat parameter.
--
-- Solusi: scope non-staff = rekan SATU ASISTEN pada jadwal yang sama.
--   Asisten pembimbing pemanggil diambil dari baris group_members miliknya
--   sendiri, lalu baris lain dibatasi ke assistant_id yang sama. Praktikan
--   yang belum diplotting (assistant_id NULL) dibandingkan dengan
--   IS NOT DISTINCT FROM agar tetap mendapat daftar teman yang sama-sama
--   belum punya asisten. Staff tetap melihat seluruh jadwal.
--
-- Catatan yang sengaja TIDAK dipakai:
--   - Tidak ada penyaring class_code. Formatnya beda antar tabel (users
--     "TSE B" vs schedules "B"), tapi dari 300 baris group_members hanya 6
--     yang beda dan semuanya data uji; menyaring dengan perbandingan longgar
--     justru menghilangkan anggota sah saat ada praktikan pindah kelas.
--   - Kolom telepon tidak dikembalikan sama sekali (nomor HP teman sekelompok
--     tidak boleh terekspos ke praktikan).
-- =========================================================================

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
    student_class_code TEXT,
    -- assistant_id milik pemanggil pada jadwal ini (NULL bila belum diplotting).
    -- Dipakai UI sebagai pembanding/pengaman, dan sebagai bukti baris-baris
    -- yang dikembalikan memang satu kelompok dengan pemanggil.
    viewer_assistant_id BIGINT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    WITH viewer_row AS (
        SELECT vg.schedule_id, vg.assistant_id
        FROM public.group_members vg
        WHERE vg.student_id = p_viewer_id
    )
    SELECT
        gm.id::BIGINT,
        gm.schedule_id::BIGINT,
        gm.student_id::BIGINT,
        gm.assistant_id::BIGINT,
        u_s.full_name::TEXT,
        u_s.username::TEXT,
        u_a.full_name::TEXT,
        COALESCE(u_s.shift, '1')::TEXT,
        u_s.class_code::TEXT,
        vr.assistant_id::BIGINT
    FROM public.group_members gm
    JOIN public.users u_s ON gm.student_id = u_s.id
    LEFT JOIN public.users u_a ON gm.assistant_id = u_a.id
    LEFT JOIN viewer_row vr ON vr.schedule_id = gm.schedule_id
    WHERE (p_schedule_id IS NULL OR gm.schedule_id = p_schedule_id)
      AND (
        public.is_staff(p_viewer_id)
        OR EXISTS (
            -- pemanggil harus terdaftar di jadwal ini ...
            SELECT 1 FROM viewer_row vr2 WHERE vr2.schedule_id = gm.schedule_id
            -- ... dan baris ini harus satu asisten dengannya
            AND gm.assistant_id IS NOT DISTINCT FROM vr2.assistant_id
        )
      );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_group_members_secure(BIGINT, BIGINT) TO anon, authenticated, service_role;
