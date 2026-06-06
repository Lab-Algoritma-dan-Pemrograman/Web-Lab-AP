import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// --- Crypto Helpers (HMAC-SHA256 untuk JWT manual agar kompatibel dan cepat) ---

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return Buffer.from(binary, "binary")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function textToBase64Url(text: string): string {
  return Buffer.from(text)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signJWT(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  // Token berlaku selama 12 jam (43200 detik)
  const fullPayload = { ...payload, iat: now, exp: now + 43200 };

  const encodedHeader = textToBase64Url(JSON.stringify(header));
  const encodedPayload = textToBase64Url(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const { createHmac } = await import("crypto");
  const signature = createHmac("sha256", secret).update(dataToSign).digest();
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${dataToSign}.${encodedSignature}`;
}

// --- Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hanya izinkan POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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

    if (loginError) {
      console.error("Database login RPC error:", loginError);
      return res.status(400).json({ error: loginError.message });
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

    // 3. Login sukses -> Hapus field sensitif sebelum membuat JWT
    const { password: _, ...safeUser } = userData;

    // 4. Generate JWT
    const token = await signJWT(safeUser, secret);

    return res.status(200).json({
      user: safeUser,
      token
    });
  } catch (err: any) {
    console.error("Login endpoint exception:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
