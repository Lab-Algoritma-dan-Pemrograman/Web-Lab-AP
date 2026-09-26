-- =========================================================================
-- Migration: Seragamkan casing divisi di division_access
--
-- Masalah: ada dua set baris untuk divisi yang sama dengan casing berbeda —
--   'Bendahara' dan 'BENDAHARA'. auth.tsx mencari hak akses memakai
--   user.division PERSIS seperti tersimpan di tabel users (di produksi:
--   'BENDAHARA'), sehingga 4 baris 'Bendahara' tidak pernah terbaca siapa pun.
--   Baris itu juga tidak pernah terbersihkan saat divisi disimpan ulang lewat
--   panel, karena admin_save_division_access menghapus dengan
--   `DELETE ... WHERE division = p_division` — cocok persis, bukan case-insensitive.
--
-- Solusi: hapus baris berscasing salah, sisakan casing yang benar-benar dipakai
--   sistem. Sengaja TIDAK memindahkan menu dari 'Bendahara' ke 'BENDAHARA':
--   itu akan menambah hak akses secara diam-diam (/manajemen-user, /input-nilai,
--   yang memang dikelola lewat panel). Tambahkan lewat panel bila memang perlu.
--
-- Idempoten: aman dijalankan berulang.
-- =========================================================================

DELETE FROM public.division_access WHERE division = 'Bendahara';

-- Verifikasi: harus tepat satu casing per divisi.
SELECT division, count(*) AS jumlah_menu
FROM public.division_access
GROUP BY division
ORDER BY division;
