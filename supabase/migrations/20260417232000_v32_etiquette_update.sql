-- =====================================================
-- Migration: ETIQUETTE UPDATE (V32)
-- Purpose: Add "Mohon maaf mengganggu waktunya" to Praktikan-to-Assistant templates
-- Resolve: ", untuk format di frontedn nya tolong tambahkan mohon maaf menggangu waktunya. Saya ....."
-- =====================================================

UPDATE public.system_settings
SET wa_templates = wa_templates || jsonb_build_object(
    'absen_izin', 'Selamat {{waktu}} {{panggilan}}, mohon maaf mengganggu waktunya. Saya {{nama}} ({{nim}}) dari kelas {{kelas}} {{jurusan}} ingin mengirimkan bukti izin: {{alasan}}',
    'chat_asisten', 'Selamat {{waktu}} {{panggilan}} {{nama_asisten}}, mohon maaf mengganggu waktunya. Saya {{nama_praktikan}} dengan NIM {{nim}} dari jurusan {{jurusan}} kelas {{kelas}}.'
)
WHERE id = 1;
