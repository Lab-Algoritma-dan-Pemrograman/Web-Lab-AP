import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function: Analyze schedule using Gemini AI
 * 
 * POST /api/analyze-schedule
 * Body: { fileBase64: string, mimeType: string }
 * Returns: { slots: Array<{ day_of_week: string, start_time: string, end_time: string }> }
 * 
 * GEMINI_API_KEY is read from process.env (Vercel Environment Variable),
 * NOT from the frontend bundle.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Read API key from server-side env
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in environment variables");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { fileBase64, mimeType, model } = req.body || {};

  if (!fileBase64 || !mimeType) {
    return res.status(400).json({ error: "fileBase64 and mimeType are required" });
  }

  // Model Mapping (Translate friendly names to API identifiers)
  // pastikan hanya ada 2 model, yakni gemini 3 flash dan 2.5 flash
  let targetModel = "gemini-3-flash"; // Default
  if (model === "gemini-3-flash") targetModel = "gemini-3-flash";
  if (model === "gemini-2.5-flash") targetModel = "gemini-2.5-flash";

  const prompt = `
    Anda adalah sistem penjadwalan cerdas. 
    Berikut adalah gambar/dokumen KRS atau Jadwal Kuliah seorang mahasiswa.
    Tugas Anda:
    1. Jam operasional asisten laboratorium adalah hari Senin sampai Sabtu, dari pukul 07:20 hingga 17:40.
    2. Analisis jadwal tersebut dan carilah JAM KOSONG (waktu di mana mahasiswa tersebut TIDAK ADA jadwal kuliah) dalam rentang jam operasional tersebut.
    3. Abaikan hari Minggu.
    4. Jika ada rentang waktu kosong yang saling berurutan di hari yang sama, gabungkan rentang tersebut menjadi satu waktu. (Contoh: kosong jam 07:20-10:00 dan 10:00-12:00 digabung jadi 07:20-12:00).
    
    Format jam harus hh:mm (contoh: 07:20, 13:30, 17:40).

    KEMBALIKAN HANYA ARRAY JSON VALID TANPA TEKS LAIN ATAU MARKDOWN BACKTICKS!
    Contoh format output wajib:
    [
        {"day_of_week": "Senin", "start_time": "07:20", "end_time": "12:00"},
        {"day_of_week": "Rabu", "start_time": "13:00", "end_time": "17:40"}
    ]
  `;

  try {
    // Use Gemini API directly via REST with dynamic model
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    const geminiBody = {
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
    };

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error("Gemini API error:", errorText);
      return res.status(502).json({ error: "Gemini API request failed" });
    }

    const geminiData = await geminiRes.json();

    // Extract text from response
    const responseText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
    console.error("Gemini analysis failed:", err);
    return res.status(500).json({ error: "Failed to analyze schedule" });
  }
}
