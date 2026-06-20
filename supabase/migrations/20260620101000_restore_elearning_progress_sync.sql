-- =========================================================================
-- Migration: MEMULIHKAN SINKRONISASI PROGRES E-LEARNING
-- Date: 2026-06-20
--
-- Konteks:
-- Migrasi lockdown (20260606040000) menonaktifkan semua akses tulis (INSERT/UPDATE)
-- langsung pada tabel `elearning_progress` untuk role `anon` dan `authenticated`.
--
-- Karena platform E-Learning eksternal mensinkronkan data langsung dari browser
-- menggunakan Supabase Anon Key (di mana auth.uid() bernilai null karena custom auth),
-- pemblokiran RLS ini menyebabkan kegagalan sinkronisasi progres belajar praktikan.
--
-- Solusi:
-- 1. Hapus policy pemblokir total "rls_elearning_block_anon_auth".
-- 2. Buat policy baru yang membolehkan SELECT untuk publik/anon.
-- 3. Buat policy baru yang membolehkan INSERT dan UPDATE untuk anon dengan
--    validasi keamanan: NIM yang dimasukkan/diperbarui wajib terdaftar di tabel `users`.
-- 4. Berikan hak akses (GRANT) SQL yang sesuai ke role anon dan authenticated.
-- =========================================================================

-- 1. Hapus policy pemblokir lama
DROP POLICY IF EXISTS "rls_elearning_block_anon_auth" ON public.elearning_progress;

-- 2. Buat policy SELECT (Membaca progres belajar)
DROP POLICY IF EXISTS "Allow public read elearning_progress" ON public.elearning_progress;
CREATE POLICY "Allow public read elearning_progress"
    ON public.elearning_progress FOR SELECT
    TO anon, authenticated
    USING (true);

-- 3. Buat policy INSERT (Memasukkan data progres baru)
-- Validasi: NIM yang dikirim wajib terdaftar di tabel users untuk mencegah spam data sampah
DROP POLICY IF EXISTS "Allow public insert elearning_progress" ON public.elearning_progress;
CREATE POLICY "Allow public insert elearning_progress"
    ON public.elearning_progress FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.nim = nim OR u.username = nim
        )
    );

-- 4. Buat policy UPDATE (Memperbarui progres belajar)
-- Validasi: NIM wajib terdaftar di tabel users
DROP POLICY IF EXISTS "Allow public update elearning_progress" ON public.elearning_progress;
CREATE POLICY "Allow public update elearning_progress"
    ON public.elearning_progress FOR UPDATE
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.nim = nim OR u.username = nim
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.nim = nim OR u.username = nim
        )
    );

-- 5. Berikan kembali hak akses PostgreSQL level ke role anon, authenticated, dan service_role
GRANT SELECT, INSERT, UPDATE ON TABLE public.elearning_progress TO anon, authenticated, service_role;
