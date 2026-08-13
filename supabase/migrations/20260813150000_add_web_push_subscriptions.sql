-- =========================================================================
-- Migration: Add Table & RPC for Web Push Subscriptions (VAPID Keys)
-- Date: 2026-08-13
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
ON public.push_subscriptions FOR ALL
TO authenticated
USING (user_id = auth.uid()::BIGINT)
WITH CHECK (user_id = auth.uid()::BIGINT);

-- ── RPC to Save / Update Push Subscription ──────────────────────────────
CREATE OR REPLACE FUNCTION public.save_push_subscription_secure(
    p_caller_id BIGINT,
    p_endpoint TEXT,
    p_p256dh TEXT,
    p_auth TEXT,
    p_user_agent TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_caller_id IS NULL OR p_caller_id = 0 THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
    VALUES (p_caller_id, p_endpoint, p_p256dh, p_auth, p_user_agent, now())
    ON CONFLICT (endpoint) 
    DO UPDATE SET 
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        updated_at = now();
END; $$;

GRANT EXECUTE ON FUNCTION public.save_push_subscription_secure TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
