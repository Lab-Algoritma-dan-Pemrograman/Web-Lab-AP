import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const ELEARNING_SUPABASE_URL = "https://tvsawtkevzfqobsfkiag.supabase.co";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verifikasi Keamanan JWT Token Web Lab AP
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing session token' });
  }

  const token = authHeader.split(' ')[1];
  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) {
    console.error("JWT_SECRET is missing on the server env");
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let userNim = '';
  let userName = '';
  try {
    const encodedSecret = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, encodedSecret);
    userNim = (payload.nim as string || payload.username as string || '');
    userName = (payload.nama as string || payload.full_name as string || 'Mahasiswa');
  } catch (err: any) {
    console.warn(`JWT verification failed for sync-elearning:`, err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  if (!userNim) {
    return res.status(400).json({ error: 'NIM pengguna tidak ditemukan di token sesi' });
  }

  // 2. Baca Kunci Service Role E-Learning dan Web Lab AP
  const elearningServiceKey = process.env.ELEARNING_SUPABASE_SERVICE_ROLE_KEY;
  const mainSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const mainServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!elearningServiceKey) {
    console.error("ELEARNING_SUPABASE_SERVICE_ROLE_KEY is missing on the server env");
    return res.status(500).json({ error: 'Konfigurasi lingkungan server untuk E-Learning belum lengkap. Harap set ELEARNING_SUPABASE_SERVICE_ROLE_KEY di Vercel.' });
  }

  if (!mainSupabaseUrl || !mainServiceKey) {
    console.error("Main Supabase URL/Service Key is missing");
    return res.status(500).json({ error: 'Server database configuration error' });
  }

  try {
    // 3. Buat koneksi ke database E-Learning dengan Service Role (Bypass RLS)
    const elearningSupabase = createClient(ELEARNING_SUPABASE_URL, elearningServiceKey);

    // a. Tarik data struktur pelajaran (levels, modules, lessons)
    const { data: levelsData, error: levelsError } = await elearningSupabase
      .from('levels')
      .select('*, modules(*, lessons(*))');

    if (levelsError) {
      console.error("Failed to fetch levels from E-Learning DB:", levelsError);
      return res.status(502).json({ error: 'Gagal mengambil data kurikulum dari E-Learning' });
    }

    // b. Tarik progres siswa berdasarkan NIM yang didapat dari JWT
    const { data: progressData, error: progressError } = await elearningSupabase
      .from('student_progress')
      .select('*')
      .eq('nim', userNim);

    if (progressError) {
      console.error("Failed to fetch student progress from E-Learning DB:", progressError);
      return res.status(502).json({ error: 'Gagal mengambil progres belajar dari E-Learning' });
    }

    // c. Tarik sesi aktif siswa
    const { data: sessionData } = await elearningSupabase
      .from('active_sessions')
      .select('*')
      .eq('nim', userNim)
      .maybeSingle();

    // 4. Kalkulasi Progres Belajar (Sama seperti logika frontend sebelumnya)
    const completedLessonIds = (progressData || [])
      .filter(p => p.completed)
      .map(p => p.lesson_id);

    let totalLessonsCount = 0;
    let completedLessonsCount = completedLessonIds.length;
    const completedLevels: string[] = [];
    let currentLevelTitle: string | null = null;

    if (levelsData) {
      const sortedLevels = [...levelsData].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      
      for (const lvl of sortedLevels) {
        let lvlTotal = 0;
        let lvlDone = 0;
        
        const sortedModules = [...(lvl.modules || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        
        for (const mod of sortedModules) {
          const sortedLessons = [...(mod.lessons || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          
          for (const lsn of sortedLessons) {
            lvlTotal++;
            totalLessonsCount++;
            if (completedLessonIds.includes(lsn.id)) {
              lvlDone++;
            }
          }
        }
        
        if (lvlTotal > 0 && lvlDone >= lvlTotal) {
          completedLevels.push(lvl.title);
        } else if (lvlDone > 0 && !currentLevelTitle) {
          currentLevelTitle = lvl.title;
        }
      }
      
      if (!currentLevelTitle) {
        const firstIncomplete = sortedLevels.find(lvl => {
          const lvlLessons = (lvl.modules || []).flatMap((m: any) => m.lessons || []);
          const lvlTotal = lvlLessons.length;
          const lvlDone = lvlLessons.filter((l: any) => completedLessonIds.includes(l.id)).length;
          return lvlTotal > 0 && lvlDone < lvlTotal;
        });
        if (firstIncomplete) {
          currentLevelTitle = firstIncomplete.title;
        }
      }
    }

    const completionPercent = totalLessonsCount > 0 ? (completedLessonsCount / totalLessonsCount) * 105 : 0; 
    const finalPercentage = Math.min(100, Math.round(completionPercent * 100) / 100);

    let lastAccessed: string | null = null;
    if (sessionData?.last_heartbeat) {
      lastAccessed = sessionData.last_heartbeat;
    } else if (progressData && progressData.length > 0) {
      const dates = progressData.map(p => p.completed_at ? new Date(p.completed_at).getTime() : 0);
      const maxDate = Math.max(...dates);
      if (maxDate > 0) {
        lastAccessed = new Date(maxDate).toISOString();
      }
    }

    const computedProgress = {
      nim: userNim,
      student_name: userName,
      completed_lessons: completedLessonsCount,
      total_lessons: totalLessonsCount,
      completion_percentage: finalPercentage,
      is_completed: totalLessonsCount > 0 && completedLessonsCount >= totalLessonsCount,
      completed_levels: completedLevels,
      current_level: currentLevelTitle || 'Belum Mulai',
      last_accessed_at: lastAccessed
    };

    // 5. Simpan Hasilnya ke Database Utama Web Lab AP (Bypass RLS secara aman dari server)
    const mainSupabase = createClient(mainSupabaseUrl, mainServiceKey);
    const { error: dbUpsertError } = await mainSupabase
      .from('elearning_progress')
      .upsert({
        nim: computedProgress.nim,
        student_name: computedProgress.student_name,
        completed_lessons: computedProgress.completed_lessons,
        lessons_completed: computedProgress.completed_lessons, // Isi juga kolom lessons_completed jika ada perbedaan kolom
        total_lessons: computedProgress.total_lessons,
        completion_percentage: computedProgress.completion_percentage,
        is_completed: computedProgress.is_completed,
        completed_levels: computedProgress.completed_levels,
        current_level: computedProgress.current_level,
        last_accessed_at: computedProgress.last_accessed_at,
        updated_at: new Date().toISOString()
      }, { onConflict: 'nim' });

    if (dbUpsertError) {
      console.error("Failed to upsert progress to main DB:", dbUpsertError);
      return res.status(500).json({ error: 'Gagal memperbarui progres ke database utama Web Lab AP' });
    }

    // 6. Kembalikan data progres yang berhasil dikalkulasi
    return res.status(200).json(computedProgress);
  } catch (err: any) {
    console.error("Sync E-Learning exception:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
