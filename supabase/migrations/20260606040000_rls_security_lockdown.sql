-- =========================================================================
-- Migration: RLS SECURITY LOCKDOWN
-- Date: 2026-06-06
-- Purpose: Menutup seluruh celah kebocoran kebijakan RLS yang mengizinkan
--          role 'public' atau 'anon' melakukan operasi INSERT/UPDATE/DELETE
--          secara langsung pada tabel-tabel sensitif.
--
-- STRATEGI:
--   - Hapus semua policy berbahaya (ALL/INSERT/UPDATE/DELETE untuk public).
--   - Buat policy baru yang ketat: hanya SELECT pada tabel tertentu yang
--     memang perlu diakses frontend untuk inisialisasi UI.
--   - Tabel sensitif diblokir total untuk akses langsung (direct query).
--   - SEMUA operasi tulis (write) WAJIB melewati RPC SECURITY DEFINER
--     yang sudah memiliki validasi hak akses internal.
-- =========================================================================


-- =========================================================================
-- 1. TABEL: users
-- SEBELUM: "Public Access" (ALL, public) -> siapa pun bisa DELETE/UPDATE user
-- SESUDAH: Blokir total, paksa lewat get_user_profile(), get_users_secure()
-- =========================================================================
DROP POLICY IF EXISTS "Public Access" ON public.users;
DROP POLICY IF EXISTS "anon can read users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.users;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "authenticated can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can only read own record direct" ON public.users;
DROP POLICY IF EXISTS "No direct select for users" ON public.users;

CREATE POLICY "rls_users_block_all" ON public.users
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 2. TABEL: system_settings
-- SEBELUM: "Public Settings" (ALL, public) -> publik bisa ubah pengumuman
-- SESUDAH: Hanya SELECT (baca pengumuman di login page)
-- =========================================================================
DROP POLICY IF EXISTS "Public Settings" ON public.system_settings;
DROP POLICY IF EXISTS "anon can read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public read access" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public read access" ON public.system_settings;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.system_settings;
DROP POLICY IF EXISTS "Only read access for system_settings" ON public.system_settings;

CREATE POLICY "rls_system_settings_read_only" ON public.system_settings
    FOR SELECT TO anon, authenticated
    USING (true);


-- =========================================================================
-- 3. TABEL: schedules
-- SEBELUM: "Public Delete/Insert/Schedule Access" (DELETE/INSERT/ALL, public)
-- SESUDAH: Hanya SELECT (UI perlu baca daftar jadwal)
-- =========================================================================
DROP POLICY IF EXISTS "Public Delete Schedules" ON public.schedules;
DROP POLICY IF EXISTS "Public Insert Schedules" ON public.schedules;
DROP POLICY IF EXISTS "Public Schedule Access" ON public.schedules;
DROP POLICY IF EXISTS "Public Select Schedules" ON public.schedules;
DROP POLICY IF EXISTS "Public read access" ON public.schedules;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.schedules;
DROP POLICY IF EXISTS "Only read access for schedules" ON public.schedules;
DROP POLICY IF EXISTS "Authenticated users can view schedules" ON public.schedules;
DROP POLICY IF EXISTS "Koordinator can manage schedules" ON public.schedules;

CREATE POLICY "rls_schedules_read_only" ON public.schedules
    FOR SELECT TO anon, authenticated
    USING (true);


-- =========================================================================
-- 4. TABEL: inventory_items
-- SEBELUM: "Public Inventory Access" (ALL, public) -> publik bisa hapus barang
-- SESUDAH: Hanya SELECT (katalog barang perlu ditampilkan)
-- =========================================================================
DROP POLICY IF EXISTS "Public Inventory Access" ON public.inventory_items;
DROP POLICY IF EXISTS "Public read access" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.inventory_items;
DROP POLICY IF EXISTS "Only read access for inventory_items" ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated users can view inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Koordinator can manage inventory" ON public.inventory_items;

CREATE POLICY "rls_inventory_items_read_only" ON public.inventory_items
    FOR SELECT TO anon, authenticated
    USING (true);


-- =========================================================================
-- 5. TABEL: group_members
-- SEBELUM: "Enable delete/insert/update/read for all users" (ALL, public)
-- SESUDAH: Blokir total, paksa lewat sync_students_to_group_secure(), dll.
-- =========================================================================
DROP POLICY IF EXISTS "Enable delete for all users" ON public.group_members;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.group_members;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.group_members;
DROP POLICY IF EXISTS "Enable update for all users" ON public.group_members;
DROP POLICY IF EXISTS "Block direct select" ON public.group_members;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.group_members;
DROP POLICY IF EXISTS "No direct access for group_members" ON public.group_members;

CREATE POLICY "rls_group_members_block_all" ON public.group_members
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 6. TABEL: attendance_logs
-- SEBELUM: UPDATE/DELETE/INSERT/SELECT untuk public -> manipulasi absensi total
-- SESUDAH: Blokir total, paksa lewat upsert_attendance_log_secure(), dll.
-- =========================================================================
DROP POLICY IF EXISTS "Allow Update Attendance" ON public.attendance_logs;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.attendance_logs;
DROP POLICY IF EXISTS "Public Insert Attendance" ON public.attendance_logs;
DROP POLICY IF EXISTS "Public View Attendance" ON public.attendance_logs;
DROP POLICY IF EXISTS "Anyone can read attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Block direct select" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.attendance_logs;
DROP POLICY IF EXISTS "No direct access for attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Public can manage attendances" ON public.attendance_logs;

CREATE POLICY "rls_attendance_logs_block_all" ON public.attendance_logs
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 7. TABEL: attendance_deletion_history
-- SEBELUM: "Full access for authenticated" (ALL, public) -> audit log dihapus
-- SESUDAH: Blokir total, paksa lewat delete_attendance_log_secure()
-- =========================================================================
DROP POLICY IF EXISTS "Full access for authenticated" ON public.attendance_deletion_history;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.attendance_deletion_history;
DROP POLICY IF EXISTS "No direct access for deletion history" ON public.attendance_deletion_history;

CREATE POLICY "rls_deletion_history_block_all" ON public.attendance_deletion_history
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 8. TABEL: division_access
-- SEBELUM: "Coord Manage" + "Coordinator Manage Access" (ALL, public)
-- SESUDAH: Hanya SELECT (frontend perlu baca hak akses menu saat login)
-- =========================================================================
DROP POLICY IF EXISTS "Coord Manage" ON public.division_access;
DROP POLICY IF EXISTS "Coordinator Manage Access" ON public.division_access;
DROP POLICY IF EXISTS "Public Read" ON public.division_access;
DROP POLICY IF EXISTS "Public Read Access" ON public.division_access;
DROP POLICY IF EXISTS "Public read access" ON public.division_access;
DROP POLICY IF EXISTS "anon can read division_access" ON public.division_access;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.division_access;
DROP POLICY IF EXISTS "Only read access for division_access" ON public.division_access;

CREATE POLICY "rls_division_access_read_only" ON public.division_access
    FOR SELECT TO anon, authenticated
    USING (true);


-- =========================================================================
-- 9. TABEL: financial_records
-- SEBELUM: "Public Finance" (ALL, public) -> publik bisa manipulasi keuangan
-- SESUDAH: Blokir total, paksa lewat get_financial_records_secure(), dll.
-- =========================================================================
DROP POLICY IF EXISTS "Public Finance" ON public.financial_records;
DROP POLICY IF EXISTS "Block direct select" ON public.financial_records;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.financial_records;
DROP POLICY IF EXISTS "No direct access for financial_records" ON public.financial_records;

CREATE POLICY "rls_financial_records_block_all" ON public.financial_records
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 10. TABEL: feedback
-- SEBELUM: "Public Insert/View Feedback" (INSERT+SELECT, public)
-- SESUDAH: Blokir total, paksa lewat insert_feedback_secure(), get_feedback_secure()
-- =========================================================================
DROP POLICY IF EXISTS "Public Insert Feedback" ON public.feedback;
DROP POLICY IF EXISTS "Public View Feedback" ON public.feedback;
DROP POLICY IF EXISTS "Block direct select" ON public.feedback;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;

CREATE POLICY "rls_feedback_block_all" ON public.feedback
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 11. TABEL: elearning_progress
-- SEBELUM: "Allow all for elearning_progress" (ALL, public)
-- SESUDAH: Blokir untuk anon/authenticated, service_role tetap boleh
--          (service_role policies sudah ada dan terpisah)
-- =========================================================================
DROP POLICY IF EXISTS "Allow all for elearning_progress" ON public.elearning_progress;
DROP POLICY IF EXISTS "Block direct select" ON public.elearning_progress;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.elearning_progress;
DROP POLICY IF EXISTS "No direct access for elearning_progress" ON public.elearning_progress;
DROP POLICY IF EXISTS "Allow public read elearning_progress" ON public.elearning_progress;
DROP POLICY IF EXISTS "Allow public insert elearning_progress" ON public.elearning_progress;
DROP POLICY IF EXISTS "Allow public update elearning_progress" ON public.elearning_progress;

CREATE POLICY "rls_elearning_block_anon_auth" ON public.elearning_progress
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);
-- Catatan: policy service_role (INSERT/UPDATE/DELETE) TETAP AKTIF di atas


-- =========================================================================
-- 12. TABEL: group_assistants
-- SEBELUM: "Enable insert/delete for all users" (ALL, public)
-- SESUDAH: Blokir total, paksa lewat upsert_group_assistant_secure(), dll.
-- =========================================================================
DROP POLICY IF EXISTS "Enable insert/delete for all users" ON public.group_assistants;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.group_assistants;
DROP POLICY IF EXISTS "Block direct select" ON public.group_assistants;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.group_assistants;
DROP POLICY IF EXISTS "No direct access for group_assistants" ON public.group_assistants;

CREATE POLICY "rls_group_assistants_block_all" ON public.group_assistants
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 13. TABEL: external_links
-- SEBELUM: "Enable all access for authenticated" (ALL, public)
-- SESUDAH: Hanya SELECT (tautan ditampilkan di halaman penunjang)
-- =========================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated" ON public.external_links;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.external_links;
DROP POLICY IF EXISTS "Block direct select" ON public.external_links;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.external_links;
DROP POLICY IF EXISTS "Only read access for external_links" ON public.external_links;

CREATE POLICY "rls_external_links_read_only" ON public.external_links
    FOR SELECT TO anon, authenticated
    USING (true);


-- =========================================================================
-- 14. TABEL: assistant_availability
-- SEBELUM: "Public read availability" (SELECT, anon) -> data internal bocor
-- SESUDAH: Blokir total, paksa lewat get_all_availability_for_user_secure()
-- =========================================================================
DROP POLICY IF EXISTS "Public read availability" ON public.assistant_availability;
DROP POLICY IF EXISTS "Block direct select" ON public.assistant_availability;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.assistant_availability;
DROP POLICY IF EXISTS "Only internal staff can read availability" ON public.assistant_availability;

CREATE POLICY "rls_assistant_availability_block_all" ON public.assistant_availability
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 15. TABEL: inventory_rentals
-- Memastikan tidak ada celah akses langsung
-- =========================================================================
DROP POLICY IF EXISTS "Allow authenticated select" ON public.inventory_rentals;

CREATE POLICY "rls_inventory_rentals_block_all" ON public.inventory_rentals
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 16. TABEL: schedule_assignments
-- Memastikan tidak ada celah akses langsung
-- =========================================================================
DROP POLICY IF EXISTS "Allow authenticated select" ON public.schedule_assignments;

CREATE POLICY "rls_schedule_assignments_block_all" ON public.schedule_assignments
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 17. TABEL: qr_sessions
-- Memastikan tidak ada celah akses langsung
-- =========================================================================
DROP POLICY IF EXISTS "Allow authenticated select" ON public.qr_sessions;

CREATE POLICY "rls_qr_sessions_block_all" ON public.qr_sessions
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 18. TABEL: sso_handshakes
-- SEBELUM: RLS disabled (dari v25 migration)
-- SESUDAH: Aktifkan RLS dan blokir, paksa lewat get_elearning_handshake_secure()
-- =========================================================================
ALTER TABLE public.sso_handshakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated select" ON public.sso_handshakes;

CREATE POLICY "rls_sso_handshakes_block_all" ON public.sso_handshakes
    FOR ALL TO anon, authenticated
    USING (false)
    WITH CHECK (false);


-- =========================================================================
-- 19. TABEL-TABEL LAIN YANG MUNGKIN ADA (safety net)
-- Blokir direct access untuk tabel operasional lain
-- =========================================================================

-- student_grades
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_grades') THEN
        DROP POLICY IF EXISTS "Allow authenticated select" ON public.student_grades;
        CREATE POLICY "rls_student_grades_block_all" ON public.student_grades
            FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
    END IF;
END $$;

-- practical_groups
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'practical_groups') THEN
        DROP POLICY IF EXISTS "Allow authenticated select" ON public.practical_groups;
        CREATE POLICY "rls_practical_groups_block_all" ON public.practical_groups
            FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
    END IF;
END $$;

-- class_rosters
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'class_rosters') THEN
        DROP POLICY IF EXISTS "Allow authenticated select" ON public.class_rosters;
        CREATE POLICY "rls_class_rosters_block_all" ON public.class_rosters
            FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
    END IF;
END $$;

-- assistant_schedules
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'assistant_schedules') THEN
        DROP POLICY IF EXISTS "Allow authenticated select" ON public.assistant_schedules;
        CREATE POLICY "rls_assistant_schedules_block_all" ON public.assistant_schedules
            FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
    END IF;
END $$;

-- equipment
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'equipment') THEN
        DROP POLICY IF EXISTS "Allow authenticated select" ON public.equipment;
        CREATE POLICY "rls_equipment_block_all" ON public.equipment
            FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
    END IF;
END $$;

-- attendance_deletion_logs (tabel lama, mungkin masih ada)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_deletion_logs') THEN
        DROP POLICY IF EXISTS "Allow authenticated select" ON public.attendance_deletion_logs;
        CREATE POLICY "rls_deletion_logs_block_all" ON public.attendance_deletion_logs
            FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
    END IF;
END $$;


-- =========================================================================
-- VERIFIKASI: Tampilkan semua kebijakan aktif setelah pembersihan
-- =========================================================================
-- Jalankan query ini secara terpisah untuk memverifikasi:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
