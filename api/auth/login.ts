import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';

// ponytail: lightweight in-memory rate limiter per warm serverless container instance
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

// --- Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hanya izinkan POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxAttempts = 5; // 5 attempts per minute

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
    
    // 1. Verifikasi kredensial menggunakan fungsi RPC
    const { data: userData, error: loginError } = await supabaseServer
      .rpc('login_user', {
        p_username: username,
        p_password: password
      })
      .maybeSingle();

    // ponytail: mask internal database schema/syntax errors to prevent information leakage
    if (loginError) {
      console.error("Database login RPC error:", loginError);
      const isSystemError = /constraint|violates|foreign key|relation|table|syntax|null value|permission denied|does not exist|column|parse/i.test(loginError.message || '');
      const clientMessage = isSystemError ? 'Terjadi kesalahan sistem. Silakan coba lagi.' : loginError.message;
      return res.status(400).json({ error: clientMessage });
    }

    if (!userData) {
      return res.status(401).json({ error: "Username tidak ditemukan atau password salah!" });
    }

    if (!userData.is_active) {
      return res.status(403).json({ error: "Akun Anda sedang dinonaktifkan." });
    }

    // 2. Cek Shift Aktif (Khusus Praktikan)
    if (userData.role === 'praktikan') {
      const { data: settings, error: settingsError } = await supabaseServer
        .from('system_settings')
        .select('active_shift')
        .maybeSingle();

      if (settingsError) {
        console.error("Failed to read system settings:", settingsError);
      }

      const activeShift = settings?.active_shift || 'all';

      if (activeShift !== 'all') {
        if (activeShift === 'none') {
          return res.status(403).json({ 
            error: "Akses Ditutup", 
            details: "Maaf, akses login saat ini sedang ditutup untuk semua praktikan." 
          });
        }
        if (!userData.shift || userData.shift === '?') {
          return res.status(403).json({ 
            error: "Akun Belum Aktif", 
            details: "Mohon tunggu plotting shift dari Koordinator sebelum Anda bisa login." 
          });
        }
        if (userData.shift !== activeShift) {
          return res.status(403).json({ 
            error: "Akses Ditolak", 
            details: `Maaf, akun Anda terdaftar di Shift ${userData.shift}. Saat ini hanya Shift ${activeShift} yang diizinkan masuk.` 
          });
        }
      }
    }

    // 3. Login sukses -> Filter payload JWT minimal agar tidak membocorkan PII (seperti no telp/shift/kelas)
    const jwtPayload = {
      id: userData.id,
      username: userData.username,
      role: userData.role,
      division: userData.division,
      nim: userData.nim,
      assistant_code: userData.assistant_code,
      full_name: userData.full_name
    };

    // 4. Generate JWT
    const token = await new SignJWT(jwtPayload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    // ponytail: Kirim safeUser lengkap untuk kebutuhan rendering UI, tapi JWT tetap minimal
    const { password: _, ...safeUser } = userData;

    return res.status(200).json({
      user: safeUser,
      token
    });
  } catch (err: any) {
    console.error("Login endpoint exception:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
