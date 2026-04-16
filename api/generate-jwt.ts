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
  if (!secret) {
    console.error("JWT_SECRET is not set in environment variables");
    return res.status(500).json({ error: "Server configuration error" });
  }

  // Verify internal secret to prevent public abuse
  const appSecret = process.env.APP_INTERNAL_SECRET;
  const clientSecret = req.headers["x-app-secret"];

  if (!appSecret || clientSecret !== appSecret) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  const { nim, nama, kelas } = req.body || {};

  if (!nim || !nama) {
    return res.status(400).json({ error: "nim and nama are required" });
  }

  try {
    const token = await signJWT({ nim, nama, kelas: kelas || "" }, secret);
    return res.status(200).json({ token });
  } catch (err: any) {
    console.error("JWT generation failed:", err);
    return res.status(500).json({ error: "Failed to generate token" });
  }
}
