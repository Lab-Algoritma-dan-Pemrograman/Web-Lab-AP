import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT } from 'jose';

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
      .select("user_id, users!inner(nim, username, full_name, role)")
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
    const finalNim = userData.nim || userData.username; // Use username as fallback for NIM
    const finalNama = userData.full_name;
    const finalRole = userData.role || "";

    if (!finalNim || !finalNama) {
      return res.status(400).json({ error: "Data pengguna tidak lengkap di database" });
    }

    // Ambil data jadwal untuk mendapatkan kelas (schedule_class) dan jurusan (schedule_major)
    let scheduleClass = "";
    let scheduleMajor = "";

    if (finalRole === 'mahasiswa') {
      const { data: scheduleData } = await supabaseServer
        .from("group_members")
        .select("schedules(class_code, major)")
        .eq("student_id", handshake.user_id)
        .limit(1)
        .maybeSingle();

      if (scheduleData) {
        const rawSchedule = (scheduleData as any).schedules;
        const target = Array.isArray(rawSchedule) ? rawSchedule[0] : rawSchedule;
        if (target) {
          scheduleClass = target.class_code || "";
          scheduleMajor = target.major || "";
        }
      }
    } else if (finalRole === 'asisten' || finalRole === 'koordinator') {
      const { data: scheduleData } = await supabaseServer
        .from("group_assistants")
        .select("schedules(class_code, major)")
        .eq("assistant_id", handshake.user_id)
        .limit(1)
        .maybeSingle();

      if (scheduleData) {
        const rawSchedule = (scheduleData as any).schedules;
        const target = Array.isArray(rawSchedule) ? rawSchedule[0] : rawSchedule;
        if (target) {
          scheduleClass = target.class_code || "";
          scheduleMajor = target.major || "";
        }
      }
    }

    // 3. Generate SSO Token (STRICT ALIGNMENT)
    const jwt = await new SignJWT({ 
        nim: finalNim, 
        nama: finalNama, 
        kelas: scheduleClass,
        jurusan: scheduleMajor,
        role: finalRole
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(new TextEncoder().encode(secret));
    
    return res.status(200).json({ token: jwt });
  } catch (err: any) {
    console.error("JWT generation failed:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
