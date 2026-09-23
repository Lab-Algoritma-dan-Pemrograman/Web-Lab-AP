// src/lib/roles.ts  —  SATU SUMBER KEBENARAN untuk nama role
// Tambahkan file baru ini, lalu impor di AppSidebar.tsx, ProtectedRoute.tsx, dan tempat lain.

/** Alias -> role kanonik. admin BUKAN alias koordinator (keputusan produk). */
export const ROLE_ALIASES: Record<string, string> = {
  mahasiswa: 'praktikan',
  mhs: 'praktikan',
  peminjam: 'penyewa',
  kordas: 'koordinator',
  korda: 'koordinator',
  coordinator: 'koordinator',
  superadmin: 'admin',
  super_admin: 'admin',
  administrator: 'admin',
};

/** Role kanonik (5): admin | koordinator | asisten | praktikan | penyewa */
export const CANON_ROLES = ['admin', 'koordinator', 'asisten', 'praktikan', 'penyewa'] as const;

export const canonRole = (r?: string | null): string =>
  ROLE_ALIASES[(r ?? '').toLowerCase().trim()] ?? (r ?? '').toLowerCase().trim();

/** admin & koordinator selalu boleh; selain itu dicek terhadap whitelist. */
export const roleAllowed = (role: string | undefined | null, allowed: string[]): boolean => {
  const r = canonRole(role);
  if (r === 'admin' || r === 'koordinator') return true;
  return allowed.map(canonRole).includes(r);
};

/** Staff = admin | koordinator | asisten */
export const isStaffRole = (role?: string | null): boolean =>
  ['admin', 'koordinator', 'asisten'].includes(canonRole(role));
