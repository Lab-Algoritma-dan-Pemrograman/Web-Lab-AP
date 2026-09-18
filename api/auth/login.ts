import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

// ponytail: lightweight in-memory rate limiter per warm serverless container instance
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

// Cookie configuration — httpOnly prevents JavaScript access (XSS mitigation)
const COOKIE_NAME = 'lab_session';
const COOKIE_OPTIONS = [
  `HttpOnly`,
  `Secure`,
  `SameSite=Strict`,
  `Path=/`,
  `Max-Age=3600` // 1 hour, matches JWT expiry
].join('; ');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hanya izinkan POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxAttempts = 5;

  // ponytail: prune expired entries to avoid memory leaks
  if (loginAttempts.size > 1000) {
    for (const [key, val] of loginAttempts.entries()) {
      if (now > val.resetTime) loginAttempts.delete(key);
    }
  }

  const attempt = loginAttempts.get(ip);
  if (attempt) {
    if (now < attempt.resetTime) {
      if (attempt.count >= maxAttempts) {
        return res.status(429).json({
          error: "Terlalu banyak percobaan login. Silakan coba lagi dalam satu menit."
        });
      }
      attempt.count++;
    } else {
      loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
    }
  } else {
    loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi." });
  }

  const secret = process.env.JWT_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing critical environment variables on server");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verifikasi kredensial
    const { data: rawUserData, error: loginError } = await supabaseServer
      .rpc('login_user', { p_username: username, p_password: password })
      .maybeSingle();

    const userData = rawUserData as any;

    // ponytail: mask internal errors
    if (loginError) {
      console.error("Database login RPC error:", loginError);
      const isSystemError = /constraint|violates|foreign key|relation|table|syntax|null value|permission denied|does not exist|column|parse/i.test(loginError.message || '');
      return res.status(400).json({ error: isSystemError ? 'Terjadi kesalahan sistem. Silakan coba lagi.' : loginError.message });
    }

    if (!userData) {
      return res.status(401).json({ error: "Username tidak ditemukan atau password salah!" });
    }

    // 2. Verifikasi bcrypt di server (Postgres tidak punya bcrypt native)
    const passwordHash = userData.password;
    delete userData.password;  // jangan pernah kirim hash ke client
    if (!passwordHash || !bcrypt.compareSync(password, passwordHash)) {
      return res.status(401).json({ error: "Username tidak ditemukan atau password salah!" });
    }

    if (!userData.is_active) {
      return res.status(403).json({ error: "Akun Anda sedang dinonaktifkan." });
    }

    // 2b. Cek Shift Aktif (Khusus Praktikan) — hanya ketika shift terisi
    if (userData.role === 'praktikan' && userData.shift !== null && userData.shift !== undefined) {
      const { data: settings } = await supabaseServer
        .from('system_settings')
        .select('active_shift')
        .maybeSingle();

      const activeShift = settings?.active_shift || 'all';

      if (activeShift !== 'all') {
        if (activeShift === 'none') {
          return res.status(403).json({ error: "Akses Ditutup", details: "Maaf, akses login saat ini sedang ditutup untuk semua praktikan." });
        }
        if (!userData.shift || userData.shift === '?') {
          return res.status(403).json({ error: "Akun Belum Aktif", details: "Mohon tunggu plotting shift dari Koordinator sebelum Anda bisa login." });
        }
        if (userData.shift !== activeShift) {
          return res.status(403).json({ error: "Akses Ditolak", details: `Maaf, akun Anda terdaftar di Shift ${userData.shift}. Saat ini hanya Shift ${activeShift} yang diizinkan masuk.` });
        }
      }
    }

    // 3. Buat payload JWT minimal (tidak termasuk PII sensitif)
    const jwtPayload = {
      id: userData.id,
      username: userData.username,
      role: userData.role,
      division: userData.division,
      nim: userData.nim,
      assistant_code: userData.assistant_code,
      full_name: userData.full_name
    };

    // 4. Sign JWT — sertakan jti (unique ID) untuk keperluan revocation
    const jti = randomUUID();
    const token = await new SignJWT(jwtPayload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setJti(jti)
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    // 5. Simpan token di httpOnly cookie (tidak bisa dibaca JavaScript = XSS-safe)
    //    JUGA kirim token di body untuk backward-compat dengan localStorage fallback
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; ${COOKIE_OPTIONS}`);

    const { password: _, ...safeUser } = userData;
    return res.status(200).json({ user: safeUser, token });

  } catch (err: any) {
    console.error("Login endpoint exception:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
