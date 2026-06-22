-- =========================================================================
-- Migration: TOKEN BLOCKLIST (Fix C-2 — JWT Revocation)
-- Date: 2026-06-22
-- Purpose: Memungkinkan logout benar-benar memblokir token sebelum expired.
--          Server menyimpan jti (JWT ID) dari token yang di-logout.
--          Setiap request ke /api/rpc dan /api/auth/verify dicek terhadap
--          blocklist ini sebelum diproses.
--
-- Strategi: 
--   - Setiap JWT yang dibuat mendapat jti (unique ID) unik
--   - Saat logout, jti disimpan ke tabel ini
--   - Token expired otomatis dibersihkan oleh scheduled cleanup
--   - Tabel kecil karena hanya menyimpan token aktif yang di-revoke
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.token_blocklist (
    id          BIGSERIAL PRIMARY KEY,
    jti         TEXT        NOT NULL UNIQUE,  -- JWT ID yang di-revoke
    user_id     BIGINT      REFERENCES public.users(id) ON DELETE CASCADE,
    revoked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL           -- Sama dengan exp di JWT
);

-- Index untuk lookup cepat saat verifikasi setiap request
CREATE INDEX IF NOT EXISTS idx_token_blocklist_jti       ON public.token_blocklist(jti);
CREATE INDEX IF NOT EXISTS idx_token_blocklist_expires_at ON public.token_blocklist(expires_at);

-- RLS: blokir semua akses langsung, hanya via service_role (proxy)
ALTER TABLE public.token_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_token_blocklist_block_all" ON public.token_blocklist
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);

GRANT ALL ON TABLE public.token_blocklist TO service_role;
GRANT ALL ON SEQUENCE public.token_blocklist_id_seq TO service_role;

-- ── RPC: Cek apakah token di-revoke ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_token_revoked(p_jti TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Bersihkan token yang sudah expired sekalian
    DELETE FROM public.token_blocklist WHERE expires_at < now();

    RETURN EXISTS (
        SELECT 1 FROM public.token_blocklist WHERE jti = p_jti
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_token_revoked(TEXT) TO service_role;

-- ── RPC: Tambah token ke blocklist ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_token(
    p_jti       TEXT,
    p_user_id   BIGINT,
    p_expires_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.token_blocklist (jti, user_id, expires_at)
    VALUES (p_jti, p_user_id, p_expires_at)
    ON CONFLICT (jti) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_token(TEXT, BIGINT, TIMESTAMPTZ) TO service_role;
