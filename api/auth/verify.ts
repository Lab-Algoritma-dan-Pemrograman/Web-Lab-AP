import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

// Baca token dari httpOnly cookie ATAU Authorization header (fallback)
function extractToken(req: VercelRequest): string | null {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=')];
    })
  );
  if (cookies['lab_session']) return cookies['lab_session'];

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.split(' ')[1];

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const secretKey = process.env.JWT_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const encodedSecret = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, encodedSecret);

    // C-2: Cek token blocklist — pastikan token belum di-revoke via logout
    if (payload.jti && supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: isRevoked } = await supabase.rpc('is_token_revoked', { p_jti: payload.jti });
      if (isRevoked) {
        res.setHeader('Set-Cookie', 'lab_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
        return res.status(401).json({ error: 'Unauthorized: Session telah berakhir. Silakan login kembali.' });
      }
    }

    const { iat, exp, jti, ...userData } = payload;
    return res.status(200).json({ user: userData });

  } catch (err: any) {
    console.warn("JWT Verification failed:", err.message);
    res.setHeader('Set-Cookie', 'lab_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}
