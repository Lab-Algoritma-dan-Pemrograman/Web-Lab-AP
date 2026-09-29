// src/lib/roles.ts — SATU SUMBER KEBENARAN untuk nama role di SIAKAD
//
// Kolom users.role di DB memakai kosakata yang berbeda dari yang dipakai kode.
// Peta ini menyatukannya.
//
// CATATAN PENTING:
// - `admin` BUKAN role tersendiri di SIAKAD. 4 user ber-role 'admin' sebenarnya
//   asisten (punya assistant_code + terdaftar di group_assistants). Di E-Learning
//   mereka tetap 'admin' — itu ditangani sisi penerima, bukan di sini.
// - `superadmin` bukan role, melainkan USERNAME (superadmin_ap, role koordinator).
//   Sengaja TIDAK dipetakan: role tak dikenal harus gagal (fail closed).

export const ROLE_ALIASES: Record<string, string> = {
  praktikan: 'praktikan',
  mhs: 'praktikan',
  mahasiswa: 'praktikan',
  peminjam: 'penyewa',
  penyewa: 'penyewa',
  kordas: 'koordinator',
  korda: 'koordinator',
  coordinator: 'koordinator',
  admin: 'asisten',        // di SIAKAD, admin = asisten
};

/** Role kanonik di SIAKAD. */
export const CANON_ROLES = ['koordinator', 'asisten', 'praktikan', 'penyewa'] as const;

export const canonRole = (r?: string | null): string =>
  ROLE_ALIASES[(r ?? '').toLowerCase().trim()] ?? (r ?? '').toLowerCase().trim();

/** koordinator selalu boleh; selain itu dicek terhadap whitelist. */
export const roleAllowed = (role: string | undefined | null, allowed: string[]): boolean => {
  const r = canonRole(role);
  if (r === 'koordinator') return true;
  return allowed.map(canonRole).includes(r);
};

/** Staff = koordinator | asisten */
export const isStaffRole = (role?: string | null): boolean =>
  ['koordinator', 'asisten'].includes(canonRole(role));

/**
 * Menu yang selalu terbuka untuk SEMUA asisten, apa pun divisinya.
 * Dikecualikan dari pembatasan division_access: halaman ini bukan hak akses
 * per-divisi, tapi alat kerja dasar (absen, QR, materi praktikum).
 * Dipakai oleh AppSidebar (visibilitas menu) dan ProtectedRoute (akses URL)
 * agar keduanya tidak bisa berbeda pendapat.
 */
export const ALWAYS_ALLOWED_MENUS = ['/absensi', '/buat-qr', '/e-learning'];
