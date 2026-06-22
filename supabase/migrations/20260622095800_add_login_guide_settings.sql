-- Migration: Tambah kolom teks panduan login, alur prosedur, dan langkah reschedule
-- yang bisa diatur dari halaman Pengaturan oleh Koordinator.

-- 1. Tambah kolom baru ke system_settings
ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS login_guide_text TEXT DEFAULT 'Pembatasan login bertujuan menjaga kestabilan server dan ketertiban praktikum di laboratorium. Pastikan Anda hanya mencoba login ketika sesi shift kelas Anda sedang aktif. Jika Anda menghadapi kendala login darurat, hubungi Asisten PJ kelas Anda.',
    ADD COLUMN IF NOT EXISTS procedure_text JSONB DEFAULT '[
        {"step": "Pendaftaran Akun", "desc": "Daftarkan akun menggunakan NIM/ID yang valid. Pilih peran Praktikan untuk mahasiswa atau Penyewa untuk umum."},
        {"step": "Masuk Sistem", "desc": "Login ke portal dengan NIM/username dan password yang telah didaftarkan pada jadwal shift aktif kelas Anda."},
        {"step": "Presensi Kehadiran", "desc": "Lakukan presensi absensi melalui menu kehadiran tepat waktu saat praktikum dimulai di laboratorium."},
        {"step": "Modul & Peminjaman", "desc": "Unduh file penunjang praktikum atau ajukan sewa inventaris barang lab langsung melalui halaman khusus."}
    ]'::jsonb,
    ADD COLUMN IF NOT EXISTS reschedule_steps TEXT DEFAULT 'Ajukan izin di menu Absensi (tab Izin) → Kirim bukti WA ke Asisten PJ → Tunggu status izin terverifikasi → Klik Pilih Jadwal untuk memilih slot pengganti → Tunggu persetujuan Asisten.';

-- 2. Update get_public_settings: tambah 3 kolom baru
DROP FUNCTION IF EXISTS public.get_public_settings();
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE (
    announcement TEXT,
    is_recruitment_open BOOLEAN,
    active_shift TEXT,
    recruitment_link TEXT,
    login_guide_text TEXT,
    procedure_text JSONB,
    reschedule_steps TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        ss.announcement,
        ss.is_recruitment_open,
        ss.active_shift,
        ss.recruitment_link,
        ss.login_guide_text,
        ss.procedure_text,
        ss.reschedule_steps
    FROM public.system_settings ss
    LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;

-- 3. Update get_system_settings_full_secure: sertakan 3 kolom baru
DROP FUNCTION IF EXISTS public.get_system_settings_full_secure(BIGINT);
CREATE OR REPLACE FUNCTION public.get_system_settings_full_secure(p_viewer_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    semester_active TEXT,
    announcement TEXT,
    is_recruitment_open BOOLEAN,
    active_shift TEXT,
    updated_at TIMESTAMPTZ,
    wa_templates JSONB,
    recruitment_link TEXT,
    login_guide_text TEXT,
    procedure_text JSONB,
    reschedule_steps TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_staff(p_viewer_id) THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    RETURN QUERY
    SELECT
        ss.id, ss.semester_active, ss.announcement, ss.is_recruitment_open,
        ss.active_shift, ss.updated_at, ss.wa_templates, ss.recruitment_link,
        ss.login_guide_text, ss.procedure_text, ss.reschedule_steps
    FROM public.system_settings ss
    LIMIT 1;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_system_settings_full_secure(BIGINT) TO authenticated;

-- 4. Update admin_update_global_settings_secure: terima 3 kolom baru dengan penanganan safeupdate
DROP FUNCTION IF EXISTS public.admin_update_global_settings_secure(BIGINT, TEXT, TEXT, BOOLEAN, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_global_settings_secure(BIGINT, TEXT, TEXT, BOOLEAN, JSONB, TEXT, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.admin_update_global_settings_secure(
    p_caller_id BIGINT,
    p_semester_active TEXT,
    p_announcement TEXT,
    p_is_recruitment_open BOOLEAN,
    p_wa_templates JSONB DEFAULT NULL,
    p_recruitment_link TEXT DEFAULT NULL,
    p_login_guide_text TEXT DEFAULT NULL,
    p_procedure_text JSONB DEFAULT NULL,
    p_reschedule_steps TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id BIGINT;
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    -- Ambil ID record system_settings yang ada (untuk mematuhi safeupdate)
    SELECT id INTO v_id FROM public.system_settings LIMIT 1;

    IF v_id IS NOT NULL THEN
        UPDATE public.system_settings SET
            semester_active        = p_semester_active,
            announcement           = p_announcement,
            is_recruitment_open    = p_is_recruitment_open,
            wa_templates           = COALESCE(p_wa_templates, wa_templates),
            recruitment_link       = COALESCE(p_recruitment_link, recruitment_link),
            login_guide_text       = COALESCE(p_login_guide_text, login_guide_text),
            procedure_text         = COALESCE(p_procedure_text, procedure_text),
            reschedule_steps       = COALESCE(p_reschedule_steps, reschedule_steps),
            updated_at             = NOW()
        WHERE id = v_id;
    ELSE
        INSERT INTO public.system_settings (
            semester_active, announcement, is_recruitment_open,
            wa_templates, recruitment_link,
            login_guide_text, procedure_text, reschedule_steps
        ) VALUES (
            p_semester_active, p_announcement, p_is_recruitment_open,
            p_wa_templates, p_recruitment_link,
            p_login_guide_text, p_procedure_text, p_reschedule_steps
        );
    END IF;

    PERFORM public.log_activity(
        p_caller_id,
        'SYSTEM_SETTINGS',
        'Mengubah pengaturan global (Semester: ' || p_semester_active || ')',
        jsonb_build_object(
            'semester_active', p_semester_active,
            'announcement', p_announcement,
            'is_recruitment_open', p_is_recruitment_open,
            'recruitment_link', p_recruitment_link
        )
    );
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_global_settings_secure(BIGINT, TEXT, TEXT, BOOLEAN, JSONB, TEXT, TEXT, JSONB, TEXT) TO authenticated;

-- 5. Perbaiki admin_update_system_setting agar menggunakan safeupdate
DROP FUNCTION IF EXISTS public.admin_update_system_setting(BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_update_system_setting(
    p_caller_id BIGINT,
    p_active_shift TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id BIGINT;
BEGIN
    IF NOT public.is_admin(p_caller_id) THEN 
        RAISE EXCEPTION 'Akses ditolak.';
    END IF;

    -- Ambil ID record system_settings yang ada (untuk mematuhi safeupdate)
    SELECT id INTO v_id FROM public.system_settings LIMIT 1;

    IF v_id IS NOT NULL THEN
        UPDATE public.system_settings 
        SET active_shift = p_active_shift, 
            updated_at = NOW()
        WHERE id = v_id;
    ELSE
        INSERT INTO public.system_settings (active_shift) VALUES (p_active_shift);
    END IF;

    PERFORM public.log_activity(
        p_caller_id, 
        'SYSTEM_SETTINGS', 
        'Mengubah shift aktif menjadi ' || p_active_shift, 
        jsonb_build_object('active_shift', p_active_shift)
    );
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_system_setting(BIGINT, TEXT) TO authenticated;
