import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function: Generate JWT token for E-Learning SSO
 * 
 * POST /api/generate-jwt
 * Body: { nim: string, nama: string, kelas: string }
 * Returns: { token: string }
 * 
 * JWT_SECRET is read from process.env (Vercel Environment Variable),
 * NOT from the frontend bundle.
 */

// --- Crypto Helpers ---

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
  const fullPayload = { ...payload, iat: now, exp: now + 7200 };

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
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Read secret from server-side env (NOT VITE_ prefixed)
  const secret = process.env.JWT_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!secret || !supabaseUrl || !supabaseAnonKey) {
    console.error("Missing critical environment variables (JWT_SECRET, SUPABASE_URL, etc)");
    return res.status(500).json({ error: "Server configuration error" });
  }

  // 1. Get Token from Authorization Header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }
  const token = authHeader.split(" ")[1];

  try {
    // 2. Verify with Supabase
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.warn("Unauthorized JWT request: Invalid Supabase session");
      return res.status(401).json({ error: "Session invalid or expired" });
    }

    const { nim, nama, kelas } = req.body || {};

    if (!nim || !nama) {
      return res.status(400).json({ error: "nim and nama are required" });
    }

    // 3. Generate SSO Token
    const jwt = await signJWT({ 
        nim, 
        nama, 
        kelas: kelas || "",
        auth_id: user.id // For extra tracing
    }, secret);
    
    return res.status(200).json({ token: jwt });
  } catch (err: any) {
    console.error("JWT generation failed:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
