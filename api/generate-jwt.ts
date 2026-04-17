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
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing critical environment variables (JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY, etc)");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { handshake_code } = req.body || {};

  if (!handshake_code) {
    return res.status(401).json({ error: "Missing handshake code" });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
    
    // 1. Verify Handshake
    const { data: handshake, error: handshakeError } = await supabaseServer
      .from("sso_handshakes")
      .select("user_id, users(nim, full_name)")
      .eq("code", handshake_code)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (handshakeError || !handshake) {
      console.warn("Invalid or expired handshake:", handshake_code);
      return res.status(401).json({ error: "Sesi verifikasi kadaluarsa. Harap coba lagi." });
    }

    // 2. Consume Handshake (Delete so it can't be reused)
    await supabaseServer.from("sso_handshakes").delete().eq("code", handshake_code);

    const userData: any = handshake.users;
    const nim = userData.nim;
    const nama = userData.full_name;

    // 3. Generate SSO Token
    const jwt = await signJWT({ 
        nim, 
        nama, 
        kelas: "", // Filled if needed
        auth_id: handshake.user_id 
    }, secret);
    
    return res.status(200).json({ token: jwt });
  } catch (err: any) {
    console.error("JWT generation failed:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
