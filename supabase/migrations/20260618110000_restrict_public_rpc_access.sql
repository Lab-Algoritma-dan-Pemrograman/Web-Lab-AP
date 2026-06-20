-- =========================================================================
-- Migration: PEMBATASAN AKSES RPC PUBLIK
-- Date: 2026-06-18
-- 
-- Konteks:
-- Sistem ini menggunakan custom auth (bukan Supabase Auth), sehingga
-- semua request dari frontend (login maupun belum login) menggunakan
-- anon key yang sama di mata Supabase.
--
-- Perlindungan NYATA ada di proxy /api/rpc yang memvalidasi JWT.
-- RPC yang bypass proxy (dipanggil langsung dari frontend) harus 
-- dibatasi seminimal mungkin.
--
-- RPC yang BOLEH diakses tanpa JWT (benar-benar publik):
--   1. login_user          — autentikasi (diperlukan sebelum punya JWT)
--   2. check_username_exists — cek NIM saat daftar (tidak bocorkan data)
--   3. get_public_settings  — pengumuman di halaman login
--   4. register_user        — daftar akun baru (dibatasi hanya role tertentu)
--   5. get_qr_session_secure — scan QR absensi (praktikan buka link QR)
--   6. get_renter_items_secure — katalog sewa (calon penyewa lihat barang)
--
-- Semua RPC lainnya HANYA boleh via proxy /api/rpc yang sudah JWT-protected.
-- =========================================================================


-- =========================================================================
-- 1. BATASI register_user: Hanya boleh daftar sebagai 'praktikan' atau 'penyewa'
--    Tanpa pembatasan ini, seseorang bisa daftar sebagai 'koordinator' atau 'asisten'
--    langsung dari browser tanpa validasi apapun.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.register_user(
    p_username      TEXT,
    p_password      TEXT,
    p_full_name     TEXT,
    p_role          TEXT DEFAULT 'praktikan',
    p_nim           TEXT DEFAULT NULL,
    p_assistant_code TEXT DEFAULT NULL,
    p_division      TEXT DEFAULT NULL,
    p_phone_number  TEXT DEFAULT NULL,
    p_class_code    TEXT DEFAULT NULL,
    p_shift         TEXT DEFAULT NULL,
    p_is_active     BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_password_hash TEXT;
BEGIN
    -- !! PEMBATASAN KRITIS !!
    -- Pendaftaran mandiri hanya diizinkan untuk role praktikan dan penyewa.
    -- Pembuatan akun asisten/koordinator HARUS lewat admin (register_users_batch
    -- atau admin_create_user yang punya validasi is_admin).
    IF p_role NOT IN ('praktikan', 'penyewa') THEN
        RAISE EXCEPTION 'Pendaftaran mandiri hanya diizinkan untuk role praktikan atau penyewa. Role "%" tidak diizinkan.', p_role;
    END IF;

    -- Validasi username tidak kosong
    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username tidak boleh kosong.';
    END IF;

    -- Cek duplikat username
    IF EXISTS (SELECT 1 FROM public.users WHERE username = p_username) THEN
        RAISE EXCEPTION 'Username "%" sudah terdaftar.', p_username;
    END IF;

    -- Validasi panjang password
    IF length(p_password) < 6 THEN
        RAISE EXCEPTION 'Password minimal 6 karakter.';
    END IF;

    -- Hash password (gunakan pgcrypto jika tersedia, fallback md5)
    v_password_hash := CASE
        WHEN (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pgcrypto') > 0
        THEN crypt(p_password, gen_salt('bf'))
        ELSE md5(p_password)
    END;

    -- Insert user baru
    INSERT INTO public.users (
        username, password_hash, full_name, role, nim,
        assistant_code, division, phone_number, class_code, shift, is_active
    ) VALUES (
        trim(p_username), v_password_hash, trim(p_full_name), p_role, p_nim,
        p_assistant_code, p_division, p_phone_number, p_class_code, p_shift, p_is_active
    );
END;
$$;

-- Grant ke anon: register_user memang perlu diakses dari halaman daftar
GRANT EXECUTE ON FUNCTION public.register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;


-- =========================================================================
-- 2. BUAT admin_create_user: Untuk pembuatan akun asisten/koordinator oleh admin
--    Terpisah dari register_user agar tidak ada celah eskalasi role
-- =========================================================================
DROP FUNCTION IF EXISTS public.admin_create_user(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_caller_id     BIGINT,
    p_username      TEXT,
    p_password      TEXT,
    p_full_name     TEXT,
    p_role          TEXT,
    p_nim           TEXT DEFAULT NULL,
    p_assistant_code TEXT DEFAULT NULL,
    p_division      TEXT DEFAULT NULL,
    p_phone_number  TEXT DEFAULT NULL,
    p_class_code    TEXT DEFAULT NULL,
    p_shift         TEXT DEFAULT NULL,
    p_is_active     BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_password_hash TEXT;
BEGIN
    -- Hanya koordinator yang bisa membuat akun dengan role apapun
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya koordinator yang dapat membuat akun staf.';
    END IF;

    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username tidak boleh kosong.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.users WHERE username = p_username) THEN
        RAISE EXCEPTION 'Username "%" sudah terdaftar.', p_username;
    END IF;

    v_password_hash := CASE
        WHEN (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pgcrypto') > 0
        THEN crypt(COALESCE(p_password, '123456'), gen_salt('bf'))
        ELSE md5(COALESCE(p_password, '123456'))
    END;

    INSERT INTO public.users (
        username, password_hash, full_name, role, nim,
        assistant_code, division, phone_number, class_code, shift, is_active
    ) VALUES (
        trim(p_username), v_password_hash, trim(p_full_name), p_role, p_nim,
        p_assistant_code, p_division, p_phone_number, p_class_code, p_shift, p_is_active
    );
END;
$$;

-- admin_create_user hanya diakses via proxy (service_role), bukan anon
GRANT EXECUTE ON FUNCTION public.admin_create_user(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
REVOKE EXECUTE ON FUNCTION public.admin_create_user(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM anon, authenticated;


-- =========================================================================
-- 3. PASTIKAN register_users_batch juga dibatasi ke admin saja
--    (Batch registration dari import CSV — hanya koordinator)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.register_users_batch(
    p_caller_id BIGINT,
    p_users     JSONB
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    user_record JSONB;
    v_role TEXT;
BEGIN
    -- Hanya koordinator yang bisa import batch
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya koordinator yang dapat melakukan registrasi massal.';
    END IF;

    FOR user_record IN SELECT * FROM jsonb_array_elements(p_users)
    LOOP
        v_role := COALESCE(user_record->>'role', 'praktikan');

        PERFORM public.admin_create_user(
            p_caller_id,
            (user_record->>'username'),
            COALESCE(user_record->>'password', '123456'),
            (user_record->>'full_name'),
            v_role,
            (user_record->>'nim'),
            (user_record->>'assistant_code'),
            (user_record->>'division'),
            (user_record->>'phone_number'),
            (user_record->>'class_code'),
            (user_record->>'shift'),
            COALESCE((user_record->>'is_active')::boolean, true)
        );
    END LOOP;
END;
$$;

-- register_users_batch hanya via proxy
GRANT EXECUTE ON FUNCTION public.register_users_batch(BIGINT, JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.register_users_batch(BIGINT, JSONB) FROM anon, authenticated;


-- =========================================================================
-- RINGKASAN KEBIJAKAN AKSES AKHIR:
--
-- Boleh diakses anon (halaman login, belum punya JWT):
--   ✅ login_user                — autentikasi
--   ✅ check_username_exists     — cek NIM di form daftar
--   ✅ get_public_settings       — pengumuman di halaman login
--   ✅ register_user             — daftar (DIBATASI: hanya praktikan/penyewa)
--   ✅ get_qr_session_secure     — scan QR (link QR dibagikan ke umum)
--   ✅ get_renter_items_secure   — katalog sewa publik
--
-- Hanya via proxy /api/rpc (butuh JWT):
--   🔒 Semua fungsi sensitif lainnya
--
-- Tidak bisa diakses sama sekali oleh anon/authenticated secara langsung:
--   🚫 Semua tabel sensitif (users, attendance_logs, financial_records, dst.)
--   🚫 register_users_batch (hanya service_role via proxy admin)
--   🚫 admin_create_user (hanya service_role via proxy admin)
-- =========================================================================
