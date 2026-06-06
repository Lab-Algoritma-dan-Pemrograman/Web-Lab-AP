import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify } from 'jose';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
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

    // Kembalikan data user yang tersimpan di payload JWT
    // (payload JWT berisi properti user seperti id, username, role, division, dsb.)
    // iat dan exp dibuang agar clean
    const { iat, exp, ...userData } = payload;
    return res.status(200).json({ user: userData });
  } catch (err: any) {
    console.warn("JWT Verification failed:", err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}
