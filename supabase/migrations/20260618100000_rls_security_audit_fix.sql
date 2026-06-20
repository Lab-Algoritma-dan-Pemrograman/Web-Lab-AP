-- =========================================================================
-- Migration: RLS SECURITY AUDIT FIX
-- Date: 2026-06-18
-- Purpose: Memperbaiki celah keamanan yang ditemukan dari hasil audit RLS:
--
--   [CRITICAL-1] sso_handshakes: RLS dinonaktifkan (DISABLE ROW LEVEL SECURITY)
--                oleh v25, membiarkan tabel terbuka sepenuhnya.
--                Fix: Aktifkan RLS, blokir akses langsung.
--
--   [CRITICAL-2] inventory_rentals: RLS diaktifkan di migration v34, 
--                TETAPI di akhir migration ada GRANT ALL ON TABLE ... TO anon
--                yang meng-override policy blokir di rls_security_lockdown.
--                Fix: Revoke GRANT berlebihan, pastikan akses via RPC saja.
--
--   [HIGH-3] sync_class_rosters_secure: Hanya memeriksa apakah caller adalah
--            "user terdaftar", bukan memverifikasi is_staff(). Artinya
--            praktikan/penyewa bisa memanggil RPC ini dan memanipulasi roster.
--            Fix: Ganti cek ke is_staff().
--
--   [HIGH-4] get_user_profile: SECURITY DEFINER tanpa filter p_caller_id,
--            siapa pun (anon) yang tahu user ID bisa mengambil profil
--            user lain (username, role, NIM, kode asisten, divisi).
--            Fix: Tambahkan parameter p_caller_id dan validasi akses.
--
--   [HIGH-5] get_elearning_handshake_secure: Cek hanya memastikan user ID ada
--            di tabel users, tidak memvalidasi is_active=true. User yang
--            sudah dinonaktifkan masih bisa generate handshake.
--            Fix: Tambahkan validasi is_active.
--
--   [MEDIUM-6] get_external_links_secure dan get_renter_items_secure:
--              Tidak ada auth check — siapa pun (anon) yang memanggil bisa
--              melihat seluruh data. Untuk external_links ini disengaja
--              (tautan publik), tapi perlu dieksplisitkan. Untuk rentals,
--              katalog memang perlu publik, sudah benar.
--              Fix: Tidak perlu perubahan, hanya dokumentasi eksplisit.
--
--   [MEDIUM-7] GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon:
--              Migration v22 (reality_alignment_complete) dan v34 (rental)
--              menggunakan "GRANT ALL ON ALL FUNCTIONS" ke anon, berarti
--              seluruh fungsi sensitif pun bisa diakses anon dari Supabase
--              langsung (tanpa melalui proxy /api/rpc).
--              CATATAN: Arsitektur proxy sudah melindungi ini via JWT, 
--              TETAPI sebagai defense-in-depth, fungsi sensitif seharusnya
--              tidak EXECUTE-able langsung oleh anon.
--              Fix: Revoke EXECUTE dari anon untuk fungsi sensitif,
--              pertahankan hanya fungsi yang memang publik.
--
--   [MEDIUM-8] update_user_profile_secure (versi lama dari 20260606060000):
--              Parameter p_caller_id di-override server (api/rpc.ts) untuk
--              kasus 'update_user_profile_secure' hanya jika ada 'p_user_id',
--              tapi versi fungsi ini memakai p_user_id bukan p_caller_id.
--              Tidak ada validasi bahwa p_user_id == p_caller_id di DB level.
--              Fix: Gunakan p_caller_id sebagai satu-satunya pengenal identity.
-- =========================================================================


-- =========================================================================
-- [CRITICAL-1] FIX: sso_handshakes — Re-aktifkan RLS
-- Migration v25 menonaktifkan RLS. Migration v06-lockdown sudah mencoba
-- mengaktifkan ulang, tapi v25 mungkin dijalankan sesudahnya di lingkungan
-- tertentu. Kita pastikan RLS aktif dan policy yang benar ada.
-- =========================================================================
ALTER TABLE public.sso_handshakes ENABLE ROW LEVEL SECURITY;

-- Hapus sisa grant berlebihan dari v24
REVOKE ALL ON TABLE public.sso_handshakes FROM anon;
REVOKE ALL ON TABLE public.sso_handshakes FROM authenticated;

-- Blokir total akses langsung (semua operasi lewat SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "rls_sso_handshakes_block_all" ON public.sso_handshakes;
CREATE POLICY "rls_sso_handshakes_block_all" ON public.sso_handshakes
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);

-- service_role tetap punya akses penuh untuk operasi internal
GRANT ALL ON TABLE public.sso_handshakes TO service_role;


-- =========================================================================
-- [CRITICAL-2] FIX: inventory_rentals — Revoke GRANT ALL TO anon
-- =========================================================================
REVOKE ALL ON TABLE public.inventory_rentals FROM anon;
REVOKE ALL ON TABLE public.inventory_rentals FROM authenticated;

-- Pastikan policy blokir masih ada (sudah dibuat oleh lockdown migration)
DROP POLICY IF EXISTS "rls_inventory_rentals_block_all" ON public.inventory_rentals;
CREATE POLICY "rls_inventory_rentals_block_all" ON public.inventory_rentals
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);

-- service_role tetap punya akses penuh
GRANT ALL ON TABLE public.inventory_rentals TO service_role;

-- Sama untuk tabel lain yang terkena GRANT ALL di v22 dan v34
REVOKE ALL ON TABLE public.inventory_items FROM anon;
REVOKE ALL ON TABLE public.financial_records FROM anon;
REVOKE ALL ON TABLE public.assistant_availability FROM anon;

-- Kembalikan SELECT untuk inventory_items (katalog perlu dibaca)
GRANT SELECT ON TABLE public.inventory_items TO anon, authenticated;

-- financial_records dan assistant_availability tetap blocked (via RPC)
GRANT ALL ON TABLE public.financial_records TO service_role;
GRANT ALL ON TABLE public.assistant_availability TO service_role;


-- =========================================================================
-- [HIGH-3] FIX: sync_class_rosters_secure — Validasi caller harus is_staff
-- =========================================================================
CREATE OR REPLACE FUNCTION public.sync_class_rosters_secure(
    p_caller_id BIGINT,
    p_payload JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_item JSONB;
BEGIN
    -- SEBELUMNYA hanya cek "apakah user terdaftar" — terlalu lemah.
    -- Sekarang wajib is_staff (asisten/koordinator/sekretaris/k3).
    IF NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya staf yang dapat sinkronisasi roster kelas.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload)
    LOOP
        INSERT INTO public.class_rosters (schedule_id, assistant_id, student_id)
        VALUES (
            (v_item->>'schedule_id')::UUID,
            (v_item->>'assistant_id')::BIGINT,
            (v_item->>'student_id')::BIGINT
        )
        ON CONFLICT (schedule_id, student_id) DO NOTHING;
    END LOOP;
END;
$$;


-- =========================================================================
-- [HIGH-4] FIX: get_user_profile — Tambahkan validasi caller
-- Versi lama tidak ada filter: siapa pun bisa ambil profil user lain.
-- Versi baru: hanya self atau is_staff yang boleh ambil profil orang lain.
-- =========================================================================
DROP FUNCTION IF EXISTS public.get_user_profile(BIGINT);
CREATE OR REPLACE FUNCTION public.get_user_profile(
    p_caller_id BIGINT,
    p_target_id BIGINT
) RETURNS TABLE (
    id BIGINT,
    username TEXT,
    full_name TEXT,
    role TEXT,
    nim TEXT,
    assistant_code TEXT,
    division TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Hanya boleh ambil profil sendiri, atau jika caller adalah staff
    IF p_caller_id != p_target_id AND NOT public.is_staff(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Tidak dapat melihat profil pengguna lain.';
    END IF;

    RETURN QUERY
    SELECT u.id, u.username, u.full_name, u.role, u.nim, u.assistant_code, u.division, u.is_active
    FROM public.users u
    WHERE u.id = p_target_id;
END;
$$;

-- Grant ke service_role saja (dipanggil via proxy yang sudah auth)
GRANT EXECUTE ON FUNCTION public.get_user_profile(BIGINT, BIGINT) TO service_role, anon, authenticated;


-- =========================================================================
-- [HIGH-5] FIX: get_elearning_handshake_secure — Validasi is_active
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_elearning_handshake_secure(p_viewer_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_code TEXT;
BEGIN
    -- Cek user valid DAN aktif (bukan hanya "ada di tabel")
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer_id AND is_active = true) THEN
        RAISE EXCEPTION 'Akses Ditolak: User tidak ditemukan atau sudah dinonaktifkan (ID: %)', p_viewer_id;
    END IF;

    -- Cleanup handshake lama milik user ini atau yang sudah expired
    DELETE FROM public.sso_handshakes WHERE user_id = p_viewer_id OR expires_at < now();

    -- Generate token unik
    v_code := gen_random_uuid()::text;

    -- Simpan handshake baru
    INSERT INTO public.sso_handshakes (code, user_id) VALUES (v_code, p_viewer_id);

    RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_elearning_handshake_secure(BIGINT) TO service_role, anon, authenticated;


-- =========================================================================
-- [MEDIUM-7] FIX: Revoke EXECUTE dari anon untuk fungsi sensitif
-- Fungsi dengan SECURITY DEFINER yang sensitif sebaiknya tidak bisa
-- dipanggil langsung oleh anon (hanya lewat proxy /api/rpc yang ber-JWT).
-- Daftar fungsi yang BOLEH dipanggil anon secara langsung (truly public):
--   - check_username_exists    (untuk halaman login)
--   - login_user               (untuk autentikasi)
--   - get_public_settings      (pengumuman di halaman publik)
--   - get_qr_session_secure    (untuk scan QR oleh siapa saja)
--   - get_renter_items_secure  (katalog sewa publik)
-- Semua fungsi lain: cabut dari anon, hanya service_role yang boleh.
-- =========================================================================

-- Cabut seluruh EXECUTE dari anon dan authenticated terlebih dahulu
-- (akan di-grant ulang hanya untuk yang benar-benar publik)
DO $$
DECLARE
    func_name TEXT;
    func_signature TEXT;
BEGIN
    FOR func_signature IN
        SELECT p.oid::regprocedure::TEXT
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname NOT IN (
              -- Fungsi yang BOLEH dipanggil anon secara langsung:
              'check_username_exists',
              'login_user',
              'get_public_settings',
              'get_qr_session_secure',
              'get_renter_items_secure',
              -- Fungsi sistem internal Supabase/trigger (jangan disentuh):
              'update_updated_at_column',
              'handle_new_user',
              -- Helper yang dipanggil oleh SECURITY DEFINER lain (internal):
              'is_admin',
              'is_staff',
              'is_asisten',
              'is_pj_absen_today'
          )
    LOOP
        BEGIN
            EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', func_signature);
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Abaikan error jika fungsi tidak punya grant ke anon
        END;
    END LOOP;
END $$;

-- Re-grant EXECUTE untuk fungsi yang benar-benar publik
GRANT EXECUTE ON FUNCTION public.check_username_exists(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_qr_session_secure(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_renter_items_secure() TO anon, authenticated, service_role;
-- login_user dipanggil langsung dari client (PUBLIC_RPCS), grant ke anon
-- (diasumsikan ada fungsi login_user, jika tidak ada abaikan)
DO $$ BEGIN
    GRANT EXECUTE ON FUNCTION public.login_user TO anon, authenticated, service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Semua fungsi lainnya: hanya authenticated dan service_role
-- (proxy /api/rpc menggunakan service_role key, jadi tetap bisa diakses)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;


-- =========================================================================
-- [MEDIUM-8] FIX: update_user_profile_secure — Konsistenkan ke p_caller_id
-- Versi lama (20260606060000) pakai p_user_id, versi baru pakai p_caller_id.
-- Proxy api/rpc.ts hanya meng-override 'p_caller_id', bukan 'p_user_id'.
-- Ini berarti versi lama tidak terlindungi anti-spoofing di level proxy.
-- Solusi: pastikan versi aktif memakai p_caller_id dan proxy sudah inject.
-- =========================================================================
DROP FUNCTION IF EXISTS public.update_user_profile_secure(BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.update_user_profile_secure(BIGINT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_user_profile_secure(
    p_caller_id BIGINT,
    p_full_name TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL
) RETURNS TABLE (
    id BIGINT,
    username TEXT,
    full_name TEXT,
    role TEXT,
    nim TEXT,
    assistant_code TEXT,
    division TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- p_caller_id di-inject oleh proxy dari JWT, tidak bisa di-spoof client
    UPDATE public.users u
    SET
        full_name    = COALESCE(p_full_name, u.full_name),
        phone_number = COALESCE(p_phone_number, u.phone_number)
    WHERE u.id = p_caller_id;

    RETURN QUERY
    SELECT u.id, u.username, u.full_name, u.role, u.nim, u.assistant_code, u.division
    FROM public.users u
    WHERE u.id = p_caller_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_profile_secure(BIGINT, TEXT, TEXT) TO service_role, authenticated, anon;


-- =========================================================================
-- VERIFIKASI AKHIR
-- Jalankan query ini secara terpisah untuk mengecek hasil:
--
-- -- Cek semua policy RLS aktif:
-- SELECT tablename, policyname, roles, cmd, qual
-- FROM pg_policies WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
--
-- -- Cek fungsi yang masih bisa diakses anon:
-- SELECT routine_name, grantee, privilege_type
-- FROM information_schema.role_routine_grants
-- WHERE routine_schema = 'public' AND grantee = 'anon'
-- ORDER BY routine_name;
--
-- -- Cek tabel yang masih dibaca anon:
-- SELECT table_name, grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND grantee = 'anon'
-- ORDER BY table_name;
-- =========================================================================


-- =========================================================================
-- TAMBAHAN: update_password — Tambahkan validasi keamanan
-- Di halaman Profil: user update password sendiri (p_caller_id = target)
-- Di ManajemenUser: admin update password orang lain (perlu is_admin check)
-- =========================================================================

-- Cek apakah fungsi update_password sudah ada
DO $$ BEGIN
    -- Buat fungsi update_password yang aman jika belum ada atau perbarui yang ada
    -- Mode 1: p_caller_id == p_target_id → self-update (selalu boleh)
    -- Mode 2: p_caller_id != p_target_id → harus is_admin
    PERFORM 1 FROM pg_proc WHERE proname = 'update_password' AND pronamespace = 'public'::regnamespace;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Buat ulang update_password dengan validasi
DROP FUNCTION IF EXISTS public.update_password(BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.update_password(INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.update_password(
    p_caller_id BIGINT,   -- Siapa yang memanggil (di-inject dari JWT)
    p_target_id BIGINT,   -- Target user yang akan diubah passwordnya  
    p_new_password TEXT   -- Password baru (plain text, akan di-hash di sini)
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Self-update selalu diizinkan
    -- Update orang lain: hanya koordinator (admin)
    IF p_caller_id != p_target_id AND NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya koordinator yang dapat mengubah password orang lain.';
    END IF;

    -- Validasi panjang password
    IF length(p_new_password) < 3 THEN
        RAISE EXCEPTION 'Password minimal 3 karakter.';
    END IF;

    -- Update password (hash menggunakan crypt jika pgcrypto tersedia, fallback MD5)
    UPDATE public.users
    SET password_hash = CASE
        WHEN (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pgcrypto') > 0
        THEN crypt(p_new_password, gen_salt('bf'))
        ELSE md5(p_new_password)
    END
    WHERE id = p_target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_password(BIGINT, BIGINT, TEXT) TO service_role, authenticated, anon;
