-- =====================================================
-- Fix: Tighten RLS policies on elearning_progress
-- 
-- Previously: INSERT and UPDATE were open to everyone (WITH CHECK (true))
-- Now: Only service_role can INSERT/UPDATE/DELETE
--       Public can still READ (for dashboard display)
-- =====================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow public insert elearning_progress" ON public.elearning_progress;
DROP POLICY IF EXISTS "Allow public update elearning_progress" ON public.elearning_progress;

-- Keep read access (needed for dashboard)
-- "Allow public read elearning_progress" already exists with USING (true) — keep it.

-- INSERT: Only allowed via service_role key (from E-Learning backend)
-- anon/authenticated users with the publishable key cannot insert
CREATE POLICY "Service role insert elearning_progress"
    ON public.elearning_progress FOR INSERT
    TO service_role
    WITH CHECK (true);

-- UPDATE: Only allowed via service_role key
CREATE POLICY "Service role update elearning_progress"
    ON public.elearning_progress FOR UPDATE
    TO service_role
    USING (true);

-- DELETE: Only allowed via service_role key
CREATE POLICY "Service role delete elearning_progress"
    ON public.elearning_progress FOR DELETE
    TO service_role
    USING (true);
