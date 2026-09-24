import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { jwtVerify } from "jose";

// PUBLIC key aman dibundel (dikirim ke browser saat subscribe) — fallback ke
// key hasil rotasi supaya push tetap hidup walau env VITE_ belum diset.
// PRIVATE key WAJIB dari env (MEDIUM-04, kunci lama bocor lewat repo publik).
const VAPID_PUBLIC_KEY =
  process.env.VITE_VAPID_PUBLIC_KEY ||
  process.env.VAPID_PUBLIC_KEY ||
  "BKAXOmOt7QXutFWQp9GEPf17gU0BkTAd_xzAeQtIWONnnnUo7XUI3m4hunhgqaY1bbuKMKw3GUq44jD5Xd2Dpc0";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = "mailto:admin@lab-ap.web.id";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/** Ambil token dari httpOnly cookie (lab_session) atau Authorization header. */
function extractToken(req: VercelRequest): string | null {
  const cookieHeader = (req.headers.cookie as string) || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=')];
    })
  );
  if (cookies['lab_session']) return cookies['lab_session'];
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1];
  return null;
}

/** Hanya staf (asisten/koordinator/admin) atau cron ber-secret yang boleh kirim push. */
async function authorize(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  // 1. Cron internal: header x-cron-secret harus cocok CRON_SECRET
  const cronSecret = req.headers['x-cron-secret'];
  const expected = process.env.CRON_SECRET;
  if (expected && cronSecret && cronSecret === expected) return true;

  // 2. User login: JWT wajib + role staf
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized: Missing session token" });
    return false;
  }
  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) {
    res.status(500).json({ error: "Server configuration error" });
    return false;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secretKey));
    const role = String((payload.role as string) || '').toLowerCase();
    const isStaff = ['asisten', 'koordinator', 'admin', 'kordas'].includes(role);
    if (!isStaff) {
      res.status(403).json({ error: "Forbidden: Hanya staf yang boleh mengirim notifikasi" });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!(await authorize(req, res))) return;

  const { targetUserId, title, body, url } = req.body || {};

  if (!title || !body) {
    return res.status(400).json({ error: "Title and body are required" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Missing database configuration" });
  }

  try {
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabaseServer.from("push_subscriptions").select("*");
    if (targetUserId) {
      const numId = Number(targetUserId);
      if (!isNaN(numId)) {
        query = query.eq("user_id", numId);
      } else {
        query = query.eq("user_id", targetUserId);
      }
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error("Gagal mengambil push_subscriptions:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ message: "No target subscriptions found", sent: 0 });
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/jadwal-jaga",
    });

    let successCount = 0;
    const expiredEndpoints: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          successCount++;
        } catch (pushErr: any) {
          console.error(`Gagal mengirim Web Push ke ${sub.endpoint}:`, pushErr?.statusCode || pushErr);
          if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
            expiredEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    // Clean up expired endpoints
    if (expiredEndpoints.length > 0) {
      await supabaseServer.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    return res.status(200).json({
      message: "Web Push processing complete",
      sent: successCount,
      total: subscriptions.length,
      cleaned: expiredEndpoints.length,
    });
  } catch (err: any) {
    console.error("Exception in send-push handler:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
