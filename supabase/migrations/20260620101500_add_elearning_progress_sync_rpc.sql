-- =========================================================================
-- Migration: TAMBAHKAN SECURE RPC UNTUK SINKRONISASI PROGRESS E-LEARNING
-- Date: 2026-06-20
--
-- Deskripsi:
-- Membuat fungsi `save_elearning_progress_secure` untuk menyimpan/memperbarui
-- data progres belajar dari database E-Learning ke database utama Web Lab AP.
--
-- Keamanan:
-- - Fungsi menggunakan SECURITY DEFINER untuk mem-bypass RLS tabel elearning_progress.
-- - Validasi identitas: Pemanggil non-staf HANYA boleh meng-update progresnya sendiri.
-- - Akses dibatasi: Hanya role `service_role` (melalui proxy API /api/rpc) yang dapat mengeksekusi.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.save_elearning_progress_secure(
    p_caller_id             BIGINT,
    p_nim                   TEXT,
    p_student_name          TEXT,
    p_completed_lessons     INTEGER,
    p_total_lessons         INTEGER,
    p_completion_percentage NUMERIC,
    p_is_completed          BOOLEAN,
    p_completed_levels      JSONB,
    p_current_level         TEXT,
    p_last_accessed_at      TIMESTAMP WITH TIME ZONE
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_caller_username TEXT;
    v_caller_nim TEXT;
BEGIN
    -- Ambil username dan nim milik pemanggil
    SELECT username, nim INTO v_caller_username, v_caller_nim 
    FROM public.users 
    WHERE id = p_caller_id;

    -- Validasi Keamanan:
    -- Jika pemanggil bukan staff (koordinator/asisten), dia HANYA boleh memperbarui datanya sendiri
    IF NOT public.is_staff(p_caller_id) THEN
        IF p_nim != v_caller_username AND p_nim != v_caller_nim THEN
            RAISE EXCEPTION 'Akses Ditolak: Anda tidak dapat memperbarui progres e-learning pengguna lain.';
        END IF;
    END IF;

    -- Lakukan upsert ke tabel elearning_progress
    INSERT INTO public.elearning_progress (
        nim, student_name, completed_lessons, total_lessons, 
        completion_percentage, is_completed, completed_levels, 
        current_level, last_accessed_at, updated_at
    ) VALUES (
        p_nim, p_student_name, p_completed_lessons, p_total_lessons,
        p_completion_percentage, p_is_completed, p_completed_levels,
        p_current_level, p_last_accessed_at, now()
    )
    ON CONFLICT (nim) DO UPDATE SET
        student_name = EXCLUDED.student_name,
        completed_lessons = EXCLUDED.completed_lessons,
        total_lessons = EXCLUDED.total_lessons,
        completion_percentage = EXCLUDED.completion_percentage,
        is_completed = EXCLUDED.is_completed,
        completed_levels = EXCLUDED.completed_levels,
        current_level = EXCLUDED.current_level,
        last_accessed_at = EXCLUDED.last_accessed_at,
        updated_at = now();
END;
$$;

-- Hanya izinkan eksekusi lewat service_role (melalui proxy API /api/rpc)
GRANT EXECUTE ON FUNCTION public.save_elearning_progress_secure(
    BIGINT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, BOOLEAN, JSONB, TEXT, TIMESTAMP WITH TIME ZONE
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.save_elearning_progress_secure(
    BIGINT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, BOOLEAN, JSONB, TEXT, TIMESTAMP WITH TIME ZONE
) FROM anon, authenticated;
