import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

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

  // Hapus cookie segera — ini yang paling penting
  res.setHeader('Set-Cookie', 'lab_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');

  // C-2: Tambahkan token ke blocklist agar tidak bisa dipakai lagi sampai expired
  const token = extractToken(req);
  const secretKey = process.env.JWT_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (token && secretKey && supabaseUrl && supabaseServiceKey) {
    try {
      const encodedSecret = new TextEncoder().encode(secretKey);
      const { payload } = await jwtVerify(token, encodedSecret);

      if (payload.jti && payload.exp && payload.id) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.rpc('revoke_token', {
          p_jti: payload.jti,
          p_user_id: payload.id as number,
          p_expires_at: new Date((payload.exp as number) * 1000).toISOString(),
        });
      }
    } catch {
      // Token sudah invalid/expired — tidak perlu diblokir, abaikan
    }
  }

  // LOW-01: 204 tanpa body — endpoint ini memang no-op selain menghapus cookie,
  // jadi tidak perlu mengembalikan informasi apa pun ke pemanggil tanpa auth.
  return res.status(204).end();
}
