-- =========================================================================
-- Migration: RPC hapus langganan Web Push (dipakai saat logout)
--
-- Masalah: src/lib/notifications.ts saat logout memanggil
--   `supabase.from("push_subscriptions").delete()` memakai anon key. Di DB
--   produksi role anon tidak punya GRANT untuk tabel itu (dan RLS hanya
--   mengizinkan authenticated/service_role), jadi penghapusan selalu 401.
--   Token push perangkat lama tidak pernah terhapus saat logout -> perangkat
--   berikutnya yang login di browser sama tetap menerima notifikasi milik
--   pengguna sebelumnya.
--
-- Solusi: RPC delete_push_subscription_secure(p_caller_id, p_endpoint) yang
--   hanya boleh menghapus baris milik pemanggil sendiri, lalu GRANT EXECUTE
--   ke authenticated + service_role (anon tidak perlu: proxy RPC selalu
--   menyuntik p_caller_id dari JWT, dan tanpa token jalur ini ditolak).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.delete_push_subscription_secure(
    p_caller_id BIGINT,
    p_endpoint TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_caller_id IS NULL OR p_caller_id = 0 THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    -- Hanya baris milik pemanggil sendiri: mencegah perangkat lain
    -- di-unsubscribe oleh user yang bukan pemiliknya.
    DELETE FROM public.push_subscriptions
    WHERE user_id = p_caller_id
      AND endpoint = p_endpoint;
END; $$;

GRANT EXECUTE ON FUNCTION public.delete_push_subscription_secure(BIGINT, TEXT) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
