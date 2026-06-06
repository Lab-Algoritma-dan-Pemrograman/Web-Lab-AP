import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

// Daftar RPC yang diizinkan untuk diakses secara publik tanpa token JWT
const PUBLIC_RPCS = [
  'check_username_exists',
  'login_user'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const fnName = req.query.fn as string;
  if (!fnName) {
    return res.status(400).json({ error: 'Missing function name' });
  }

  let userId: number | null = null;
  let userRole: string | null = null;

  // 1. Verifikasi Keamanan JWT Token (Kecuali RPC Publik)
  if (!PUBLIC_RPCS.includes(fnName)) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing session token' });
    }

    const token = authHeader.split(' ')[1];
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      console.error("JWT_SECRET is missing on the server env");
      return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
      const encodedSecret = new TextEncoder().encode(secretKey);
      const { payload } = await jwtVerify(token, encodedSecret);
      userId = payload.id as number;
      userRole = payload.role as string;
    } catch (err: any) {
      console.warn(`JWT verification failed for RPC ${fnName}:`, err.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
  }

  // 2. Persiapan Parameter dan Pencegahan Spoofing
  // Ambil body yang dikirim oleh client
  const params = { ...(req.body || {}) };

  // Jika user terverifikasi (dari JWT), timpa/suntikkan parameter identitas secara paksa
  if (userId !== null) {
    // Timpa p_viewer_id jika terdapat di parameter atau jika fungsi bertindak sebagai get/view
    if ('p_viewer_id' in params) {
      params['p_viewer_id'] = userId;
    }
    
    // Timpa p_caller_id jika terdapat di parameter
    if ('p_caller_id' in params) {
      params['p_caller_id'] = userId;
    }

    // Kasus khusus untuk p_user_id di update_user_profile_secure (bukan admin)
    if (fnName === 'update_user_profile_secure' && 'p_user_id' in params) {
      params['p_user_id'] = userId;
    }
    
    // Kasus khusus check_already_absent_secure atau rpc sejenis yang memakai p_user_id untuk diri sendiri
    if (fnName === 'check_already_absent_secure' && 'p_user_id' in params) {
      params['p_user_id'] = userId;
    }
  }

  // 3. Eksekusi RPC ke Supabase dengan Service Role Key
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing database environment variables");
    return res.status(500).json({ error: "Server database configuration error" });
  }

  try {
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabaseServer.rpc(fnName, params);

    if (error) {
      console.error(`Database Error in RPC [${fnName}]:`, error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err: any) {
    console.error(`Proxy Exception in RPC [${fnName}]:`, err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
