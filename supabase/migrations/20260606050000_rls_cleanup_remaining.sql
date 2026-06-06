-- =========================================================================
-- Migration: CLEANUP REMAINING DANGEROUS POLICIES
-- Date: 2026-06-06
-- Purpose: Menghapus sisa policy lama di qr_sessions dan schedule_assignments
--          yang masih memberikan akses INSERT/UPDATE/DELETE ke role 'public'.
-- =========================================================================

-- qr_sessions: hapus 4 policy lama
DROP POLICY IF EXISTS "Public Update QR" ON public.qr_sessions;
DROP POLICY IF EXISTS "Public Create QR" ON public.qr_sessions;
DROP POLICY IF EXISTS "Public Read QR" ON public.qr_sessions;
DROP POLICY IF EXISTS "Block direct select" ON public.qr_sessions;

-- schedule_assignments: hapus 2 policy lama
DROP POLICY IF EXISTS "Staff Manage Assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Public Read Assignments" ON public.schedule_assignments;
