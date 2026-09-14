import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify } from 'jose';

/**
 * Vercel Serverless Function: Analyze schedule using Gemini AI or Bynara Router
 * 
 * POST /api/analyze-schedule
 * Body: { fileBase64: string, mimeType: string, model: string }
 * Returns: { slots: Array<{ day_of_week: string, start_time: string, end_time: string }> }
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify dynamic JWT Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: Missing session token" });
  }

  const token = authHeader.split(' ')[1];
  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) {
    console.error("JWT_SECRET is missing on the server env");
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let userRole = '';
  try {
    const encodedSecret = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, encodedSecret);
    userRole = (payload.role as string || '').toLowerCase();
  } catch (err: any) {
    console.warn(`JWT verification failed for analyze-schedule:`, err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  if (userRole !== 'asisten' && userRole !== 'koordinator') {
    return res.status(403).json({ error: "Forbidden: Hanya staf/asisten yang dapat melakukan analisis jadwal KRS" });
  }

  const { fileBase64, mimeType, model } = req.body || {};

  if (!fileBase64 || !mimeType) {
    return res.status(400).json({ error: "fileBase64 and mimeType are required" });
  }

  const prompt = `
    Anda adalah sistem penjadwalan cerdas. 
    Berikut adalah gambar/dokumen KRS atau Jadwal Kuliah seorang mahasiswa.
    Tugas Anda:
    1. Jam operasional asisten laboratorium adalah hari Senin sampai Sabtu, dari pukul 06:00 hingga 22:00.
    2. Analisis jadwal tersebut dan carilah JAM KOSONG (waktu di mana mahasiswa tersebut TIDAK ADA jadwal kuliah) dalam rentang jam operasional tersebut (06:00 - 22:00).
    3. Abaikan hari Minggu.
    4. Jika ada rentang waktu kosong yang saling berurutan di hari yang sama, gabungkan rentang tersebut menjadi satu waktu. (Contoh: kosong jam 06:00-10:00 dan 10:00-12:00 digabung jadi 06:00-12:00).
    
    Format jam harus hh:mm (contoh: 06:00, 13:30, 22:00).

    KEMBALIKAN HANYA ARRAY JSON VALID TANPA TEKS LAIN ATAU MARKDOWN BACKTICKS!
    Contoh format output wajib:
    [
        {"day_of_week": "Senin", "start_time": "06:00", "end_time": "12:00"},
        {"day_of_week": "Rabu", "start_time": "13:00", "end_time": "22:00"}
    ]
  `;

  try {
    let responseText = "";

    if (model === "stepfun-3.7-flash") {
      const bynaraApiKey = process.env.BYNARA_API_KEY || process.env.ROUTER_BYNARA_API_KEY;
      if (!bynaraApiKey) {
        console.error("BYNARA_API_KEY is not set in environment variables");
        return res.status(500).json({ error: "BYNARA_API_KEY belum dikonfigurasi di server" });
      }

      const bynaraRes = await fetch("https://router.bynara.id/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${bynaraApiKey}`
        },
        body: JSON.stringify({
          model: "stepfun-3.7-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${fileBase64}`
                  }
                }
              ]
            }
          ]
        })
      });

      if (!bynaraRes.ok) {
        const errorText = await bynaraRes.text();
        console.error("Bynara API error:", errorText);
        return res.status(502).json({ error: "Bynara API request failed" });
      }

      const bynaraData = await bynaraRes.json();
      responseText = bynaraData?.choices?.[0]?.message?.content || "";

    } else {
      // Default: Gemini API
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        console.error("GEMINI_API_KEY is not set in environment variables");
        return res.status(500).json({ error: "GEMINI_API_KEY belum dikonfigurasi di server" });
      }

      let targetModel = "gemini-3-flash";
      if (model === "gemini-2.5-flash") targetModel = "gemini-2.5-flash";

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${geminiApiKey}`;

      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: fileBase64,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!geminiRes.ok) {
        const errorText = await geminiRes.text();
        console.error("Gemini API error:", errorText);
        return res.status(502).json({ error: "Gemini API request failed" });
      }

      const geminiData = await geminiRes.json();
      responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    // Clean and parse JSON
    const cleanJson = responseText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const slots = JSON.parse(cleanJson);

    if (!Array.isArray(slots)) {
      return res.status(422).json({ error: "AI returned invalid format", raw: responseText });
    }

    return res.status(200).json({ slots });
  } catch (err: any) {
    console.error("Schedule analysis failed:", err);
    return res.status(500).json({ error: "Failed to analyze schedule" });
  }
}
