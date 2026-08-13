import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

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

  const { targetPhone, targetUserId, message } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "Message content is required" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Missing database configuration" });
  }

  try {
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch WA Gateway Configuration from system_settings
    const { data: settingsList, error: settingsErr } = await supabaseServer
      .from("system_settings")
      .select("wa_gateway_provider, wa_gateway_token, wa_auto_notify_enabled")
      .limit(1);

    if (settingsErr) {
      console.error("Gagal mengambil system_settings:", settingsErr);
    }

    const settings: any = settingsList && settingsList.length > 0 ? settingsList[0] : {};
    const provider = settings.wa_gateway_provider || "fonnte";
    const token = settings.wa_gateway_token || process.env.WA_GATEWAY_TOKEN;
    const isEnabled = settings.wa_auto_notify_enabled !== false;

    if (!isEnabled) {
      return res.status(200).json({ message: "WhatsApp auto-notify is disabled in settings", sent: false });
    }

    if (!token) {
      return res.status(400).json({
        error: "WA Gateway API Token belum dikonfigurasi. Silakan isi API Token di menu Pengaturan.",
        sent: false,
      });
    }

    // 2. Resolve target phone number if targetUserId is provided
    let recipientPhone = targetPhone;
    if (!recipientPhone && targetUserId) {
      const numId = Number(targetUserId);
      const { data: userRecord } = await supabaseServer
        .from("users")
        .select("phone")
        .eq("id", numId)
        .maybeSingle();

      if (userRecord?.phone) {
        recipientPhone = userRecord.phone;
      }
    }

    if (!recipientPhone) {
      return res.status(400).json({ error: "Nomor WhatsApp tujuan tidak ditemukan.", sent: false });
    }

    // Format phone number to international 62 format
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, "").replace(/^0/, "62");

    let apiRes;

    // 3. Dispatch HTTP request according to chosen WA Gateway provider
    if (provider === "fonnte") {
      // Fonnte API (https://api.fonnte.com/send)
      apiRes = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: cleanPhone,
          message,
        }),
      });
    } else if (provider === "wablas") {
      // Wablas API (https://kudus.wablas.com/api/send-message)
      apiRes = await fetch("https://kudus.wablas.com/api/send-message", {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message,
        }),
      });
    } else if (provider === "whacenter") {
      // Whacenter API (https://app.whacenter.com/api/send)
      apiRes = await fetch("https://app.whacenter.com/api/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_id: token,
          number: cleanPhone,
          message,
        }),
      });
    } else {
      // Custom HTTP Webhook Gateway
      apiRes = await fetch(provider, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: cleanPhone,
          message,
        }),
      });
    }

    const responseText = await apiRes.text();
    console.log(`WA Gateway Broadcast Response (${provider}):`, responseText);

    return res.status(200).json({
      status: "ok",
      provider,
      recipient: cleanPhone,
      response: responseText,
      sent: true,
    });
  } catch (err: any) {
    console.error("Exception in send-wa handler:", err);
    return res.status(500).json({ error: err.message || "Internal server error", sent: false });
  }
}
