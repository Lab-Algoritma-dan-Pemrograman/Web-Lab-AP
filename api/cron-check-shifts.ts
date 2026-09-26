import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { getDailyQuote } from "../src/lib/quotes.js";

// MEDIUM-04: TIDAK ADA fallback hardcoded. Kunci VAPID private pernah bocor
// (repo publik) → sudah dirotasi. Kini wajib dari env Vercel; jika kosong,
// endpoint ini mengirim alert dan berhenti alih-alih memakai kunci bocor.
// PUBLIC key aman dibundel (memang dipublikasikan ke browser) — fallback ke
// key hasil rotasi supaya push tetap hidup walau env VITE_ belum diset.
const VAPID_PUBLIC_KEY =
  process.env.VITE_VAPID_PUBLIC_KEY ||
  process.env.VAPID_PUBLIC_KEY ||
  "BKAXOmOt7QXutFWQp9GEPf17gU0BkTAd_xzAeQtIWONnnnUo7XUI3m4hunhgqaY1bbuKMKw3GUq44jD5Xd2Dpc0";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = "mailto:admin@lab-ap.web.id";

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("[cron-check-shifts] VAPID keys belum diset di environment — push tidak akan dikirim.");
}
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Missing database configuration" });
  }

  try {
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Fetch today's assignments with schedule & user details
    const { data: assignments, error: assignErr } = await supabaseServer
      .from("schedule_assignments")
      .select("*, schedule:schedules(*), user:users(*)")
      .eq("activity_date", todayStr)
      .or("status.is.null,status.eq.aktif");

    if (assignErr) {
      console.error("Gagal mengambil schedule_assignments:", assignErr);
      return res.status(500).json({ error: assignErr.message });
    }

    if (!assignments || assignments.length === 0) {
      return res.status(200).json({ message: "No assignments today", processed: 0 });
    }

    // Fetch all VAPID push subscriptions
    const { data: subscriptions, error: subErr } = await supabaseServer
      .from("push_subscriptions")
      .select("*");

    if (subErr || !subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ message: "No push subscriptions registered", processed: 0 });
    }

    let pushCount = 0;

    for (const assignment of assignments) {
      if (!assignment.user_id || !assignment.schedule?.start_time) continue;

      const userSubs = subscriptions.filter((s) => s.user_id === assignment.user_id);
      if (userSubs.length === 0) continue;

      const timeParts = assignment.schedule.start_time.split(":");
      const shiftHours = parseInt(timeParts[0], 10);
      const shiftMinutes = parseInt(timeParts[1], 10);

      const shiftTime = new Date(now);
      shiftTime.setHours(shiftHours, shiftMinutes, 0, 0);

      const diffMs = shiftTime.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      let pushTitle = "";
      let pushBody = "";

      const userRole = assignment.user?.role || "asisten";
      const quote = getDailyQuote(userRole);
      const startTimeStr = assignment.schedule.start_time.slice(0, 5);
      const taskRole = assignment.task_role || "Petugas";
      const activityName = assignment.activity_name || "Praktikum";

      if (diffMinutes <= 30 && diffMinutes > 15) {
        pushTitle = "🚨 30 Menit Lagi! Jadwal Jaga Segera Dimulai";
        pushBody = `Perhatian! 30 menit lagi kamu bertugas sebagai ${taskRole} di ${activityName} (Pukul ${startTimeStr} WIB). Segera menuju laboratorium!\n\n✨ "${quote}"`;
      } else if (diffMinutes <= 60 && diffMinutes > 45) {
        pushTitle = "⏳ 1 Jam Lagi! Jadwal Jaga";
        pushBody = `Persiapkan diri! 1 jam lagi kamu bertugas sebagai ${taskRole} di ${activityName} (Pukul ${startTimeStr} WIB).\n\n✨ "${quote}"`;
      } else if (diffMinutes <= 120 && diffMinutes > 105) {
        pushTitle = "⏰ 2 Jam Lagi! Jadwal Jaga";
        pushBody = `Halo, 2 jam lagi kamu bertugas sebagai ${taskRole} di ${activityName} (Pukul ${startTimeStr} WIB).\n\n✨ "${quote}"`;
      }

      if (pushTitle && pushBody) {
        const payload = JSON.stringify({
          title: pushTitle,
          body: pushBody,
          url: "/jadwal-jaga",
        });

        for (const sub of userSubs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            pushCount++;
          } catch (e: any) {
            if (e?.statusCode === 410 || e?.statusCode === 404) {
              await supabaseServer.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            }
          }
        }
      }
    }

    return res.status(200).json({
      status: "ok",
      timestamp: now.toISOString(),
      notificationsSent: pushCount,
    });
  } catch (err: any) {
    console.error("Exception in cron-check-shifts:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
