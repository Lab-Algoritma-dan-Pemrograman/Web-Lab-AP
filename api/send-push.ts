import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || "BIrsvU55B5AXjGVqi1kVqKgINewqYRiIFE5wDBAapS17GQiA8Xx5hphZ40Q4d-u83wt5zGYzjzqQuzbufcz7XuU";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "HcUZLw1hhIKxj2Hy9JWLP_9AVsgK-ee6J8YhCX9hw9g";
const VAPID_SUBJECT = "mailto:admin@lab-ap.web.id";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
      query = query.eq("user_id", targetUserId);
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
