-- =========================================================================
-- MIGRATION: Import Pembagian Asisten & Plotting Praktikan dari Master Excel
-- Tanggal: 2026-09-21T22:49:09.003Z
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- KELAS: Teknik Elektro - Kelas E (TE E)
-- -------------------------------------------------------------------------
-- 1. Pastikan Tim Asisten Terdaftar di group_assistants
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'E'
  AND u.full_name = 'ACHMAD SABILL ALDANDHY NADJAR'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'E'
  AND u.full_name = 'NAUFAL RAIHAN SAPUTRA'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'E'
  AND u.full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'E'
  AND u.full_name = 'AYLA ANATRYA MUHAMMAD'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;

-- 2. Update Plotting Asisten untuk Praktikan (35 mahasiswa)
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202511053';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611014';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611015';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611020';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611021';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611026';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611038';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611041';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611043';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611047';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611049';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611055';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611071';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611085';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611088';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611091';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611108';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611113';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611115';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611119';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611122';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611123';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611124';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611127';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611144';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611145';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611147';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611148';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611154';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611157';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611160';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611161';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611167';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611175';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'E'
  AND u.username = '202611176';

-- -------------------------------------------------------------------------
-- KELAS: Teknologi Listrik - Kelas A (TL A)
-- -------------------------------------------------------------------------
-- 1. Pastikan Tim Asisten Terdaftar di group_assistants
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknologi Listrik' AND s.class_code = 'A'
  AND u.full_name = 'NAWAL ALFIYYAH WIDAD TAMAM'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknologi Listrik' AND s.class_code = 'A'
  AND u.full_name = 'AYLA ANATRYA MUHAMMAD'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknologi Listrik' AND s.class_code = 'A'
  AND u.full_name = 'NAUFAL YASSAR'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknologi Listrik' AND s.class_code = 'A'
  AND u.full_name = 'JEVANDRY'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknologi Listrik' AND s.class_code = 'A'
  AND u.full_name = 'ERLAND HIBATURRAHMAN'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;

-- 2. Update Plotting Asisten untuk Praktikan (23 mahasiswa)
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671001';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671002';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671003';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671004';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671005';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671006';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671007';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671008';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671009';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671010';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671011';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671012';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671013';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671014';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671015';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671016';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671017';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671018';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671019';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671020';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671021';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671022';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknologi Listrik'
  AND s.class_code = 'A'
  AND u.username = '202671023';

-- -------------------------------------------------------------------------
-- KELAS: Teknik Elektro - Kelas A (TE A)
-- -------------------------------------------------------------------------
-- 1. Pastikan Tim Asisten Terdaftar di group_assistants
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'A'
  AND u.full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'A'
  AND u.full_name = 'ROUUF MUSTHOFA ARKAAN'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'A'
  AND u.full_name = 'NAUFAL RAIHAN SAPUTRA'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'A'
  AND u.full_name = 'IDA AYU PRINCESS ANGELYCA'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;

-- 2. Update Plotting Asisten untuk Praktikan (36 mahasiswa)
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202511149';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611006';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611007';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611010';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611016';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611029';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611035';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611042';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611050';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611053';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611062';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611065';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611068';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611077';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611081';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611084';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611094';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611095';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611097';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611100';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611101';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611102';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611104';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611116';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611118';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611137';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611139';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611140';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611143';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611146';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611150';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611152';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611156';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611159';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611165';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'A'
  AND u.username = '202611172';

-- -------------------------------------------------------------------------
-- KELAS: Teknik Elektro - Kelas B (TE B)
-- -------------------------------------------------------------------------
-- 1. Pastikan Tim Asisten Terdaftar di group_assistants
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'B'
  AND u.full_name = 'JEVANDRY'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'B'
  AND u.full_name = 'NAWAL ALFIYYAH WIDAD TAMAM'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'B'
  AND u.full_name = 'NAUFAL YASSAR'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'B'
  AND u.full_name = 'ERLAND HIBATURRAHMAN'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'B'
  AND u.full_name = 'IDA AYU PRINCESS ANGELYCA'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;

-- 2. Update Plotting Asisten untuk Praktikan (38 mahasiswa)
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202511013';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202511023';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202511092';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611001';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611002';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611003';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611017';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611019';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611025';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611030';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611033';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611039';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611045';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611054';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611056';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611059';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611061';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611066';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611072';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611083';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611086';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611099';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'IDA AYU PRINCESS ANGELYCA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611106';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611117';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611120';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611125';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611129';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611131';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611133';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611136';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611141';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611142';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611149';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611155';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611158';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611162';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611164';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'B'
  AND u.username = '202611166';

-- -------------------------------------------------------------------------
-- KELAS: Teknik Elektro - Kelas C (TE C)
-- -------------------------------------------------------------------------
-- 1. Pastikan Tim Asisten Terdaftar di group_assistants
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'C'
  AND u.full_name = 'NAUFAL YASSAR'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'C'
  AND u.full_name = 'REVALDO PRATAMA ROSSY'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'C'
  AND u.full_name = 'AULIYA HAQY IMAMMAH'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'C'
  AND u.full_name = 'ACHMAD SABILL ALDANDHY NADJAR'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'C'
  AND u.full_name = 'ERLAND HIBATURRAHMAN'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;

-- 2. Update Plotting Asisten untuk Praktikan (35 mahasiswa)
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611004';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611005';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611011';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611012';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611013';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611023';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611027';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611028';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611032';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611040';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611044';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611048';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611052';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611060';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611063';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611064';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611069';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611074';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611076';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611078';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ERLAND HIBATURRAHMAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611080';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611082';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611087';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611089';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ACHMAD SABILL ALDANDHY NADJAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611092';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611093';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611105';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611107';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611111';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611112';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611121';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611128';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611169';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611171';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL YASSAR' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'C'
  AND u.username = '202611174';

-- -------------------------------------------------------------------------
-- KELAS: Teknik Elektro - Kelas D (TE D)
-- -------------------------------------------------------------------------
-- 1. Pastikan Tim Asisten Terdaftar di group_assistants
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'D'
  AND u.full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'D'
  AND u.full_name = 'AYLA ANATRYA MUHAMMAD'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'D'
  AND u.full_name = 'NAUFAL RAIHAN SAPUTRA'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Elektro' AND s.class_code = 'D'
  AND u.full_name = 'REVALDO PRATAMA ROSSY'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;

-- 2. Update Plotting Asisten untuk Praktikan (35 mahasiswa)
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611008';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611009';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611018';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611022';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611024';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611034';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611036';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611037';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611046';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611057';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611058';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611067';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611070';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611073';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611075';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611079';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611090';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611096';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611098';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611103';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611109';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611110';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611114';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611126';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611130';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611132';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611134';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611135';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611138';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AYLA ANATRYA MUHAMMAD' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611151';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611153';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611163';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611168';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611170';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Elektro'
  AND s.class_code = 'D'
  AND u.username = '202611173';

-- -------------------------------------------------------------------------
-- KELAS: Teknik Sistem Energi - Kelas A (TSE A)
-- -------------------------------------------------------------------------
-- -------------------------------------------------------------------------
-- KELAS: Teknik Sistem Energi - Kelas B (TSE B)
-- -------------------------------------------------------------------------
-- 1. Pastikan Tim Asisten Terdaftar di group_assistants
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Sistem Energi' AND s.class_code = 'B'
  AND u.full_name = 'NAWAL ALFIYYAH WIDAD TAMAM'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Sistem Energi' AND s.class_code = 'B'
  AND u.full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Sistem Energi' AND s.class_code = 'B'
  AND u.full_name = 'ROUUF MUSTHOFA ARKAAN'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Sistem Energi' AND s.class_code = 'B'
  AND u.full_name = 'JEVANDRY'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;

-- 2. Update Plotting Asisten untuk Praktikan (33 mahasiswa)
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615002';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615003';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615004';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615005';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615007';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615010';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615013';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615016';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615017';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615019';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615020';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615021';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615027';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615028';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615030';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615031';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202611031';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615033';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615034';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615038';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'JEVANDRY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615039';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615043';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615045';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615048';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615050';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615051';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202611051';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615052';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'MUHAMMAD ANIS FAUZI MUHIBBIN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615053';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615059';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615061';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615065';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAWAL ALFIYYAH WIDAD TAMAM' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'B'
  AND u.username = '202615095';

-- -------------------------------------------------------------------------
-- KELAS: Teknik Sistem Energi - Kelas C (TSE C)
-- -------------------------------------------------------------------------
-- 1. Pastikan Tim Asisten Terdaftar di group_assistants
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Sistem Energi' AND s.class_code = 'C'
  AND u.full_name = 'NAUFAL RAIHAN SAPUTRA'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Sistem Energi' AND s.class_code = 'C'
  AND u.full_name = 'ROUUF MUSTHOFA ARKAAN'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Sistem Energi' AND s.class_code = 'C'
  AND u.full_name = 'REVALDO PRATAMA ROSSY'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;
INSERT INTO public.group_assistants (schedule_id, assistant_id)
SELECT s.id, u.id
FROM public.schedules s, public.users u
WHERE s.major = 'Teknik Sistem Energi' AND s.class_code = 'C'
  AND u.full_name = 'AULIYA HAQY IMAMMAH'
ON CONFLICT (schedule_id, assistant_id) DO NOTHING;

-- 2. Update Plotting Asisten untuk Praktikan (31 mahasiswa)
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615001';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615006';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615008';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615009';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615011';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615012';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615015';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615022';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615023';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615024';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615029';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615037';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615040';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615041';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615042';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615046';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615047';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615054';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'AULIYA HAQY IMAMMAH' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615055';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615060';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615062';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615067';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'REVALDO PRATAMA ROSSY' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615068';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615069';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615070';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615071';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'ROUUF MUSTHOFA ARKAAN' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615072';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615073';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615074';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615075';
UPDATE public.group_members gm
SET assistant_id = (SELECT id FROM public.users WHERE full_name = 'NAUFAL RAIHAN SAPUTRA' LIMIT 1)
FROM public.schedules s, public.users u
WHERE gm.schedule_id = s.id
  AND gm.student_id = u.id
  AND s.major = 'Teknik Sistem Energi'
  AND s.class_code = 'C'
  AND u.username = '202615098';

COMMIT;

-- Selesai: Total group_assistants di-insert = 35, Total group_members di-update = 266