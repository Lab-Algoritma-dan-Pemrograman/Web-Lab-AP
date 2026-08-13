import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

// Daftar RPC yang diizinkan untuk diakses secara publik tanpa token JWT
// Daftar RPC yang diizinkan untuk diakses secara publik tanpa token JWT
const PUBLIC_RPCS = [
  'check_username_exists',
  'login_user',
  'register_user',
  'get_public_settings',
  'get_qr_session_secure',
  'get_renter_items_secure'
];

// Pemetaan Hak Akses RPC berdasarkan Role User (Zero-Trust RBAC)
const ROLE_PERMISSIONS: Record<string, string[]> = {
  praktikan: [
    'get_user_profile',
    'update_user_profile_secure',
    'update_password',
    'check_already_absent_secure',
    'upsert_attendance_log_secure',
    'get_external_links_secure',
    'get_personal_schedules_secure',
    'get_smart_validation_contact_secure',
    'request_reschedule_secure',
    'get_division_access_secure',
    'check_menu_access_secure',
    'get_elearning_handshake_secure',
    'get_my_rentals_secure',
    'submit_rental_request_secure',
    'save_elearning_progress_secure',
    'get_dashboard_stats_secure',
    'get_attendance_logs_secure',
    'get_group_members_secure',
    'insert_feedback_secure',
    'get_feedback_secure',
    'get_schedules_secure',
    'get_system_settings_full_secure',
    'save_push_subscription_secure'
  ],
  penyewa: [
    'get_user_profile',
    'update_user_profile_secure',
    'update_password',
    'get_my_rentals_secure',
    'submit_rental_request_secure'
  ],
  asisten: [
    'get_user_profile',
    'update_user_profile_secure',
    'update_password',
    'check_already_absent_secure',
    'upsert_attendance_log_secure',
    'get_external_links_secure',
    'get_personal_schedules_secure',
    'get_smart_validation_contact_secure',
    'request_reschedule_secure',
    'get_division_access_secure',
    'get_audit_logs_secure',
    'check_menu_access_secure',
    'get_elearning_handshake_secure',
    'get_my_rentals_secure',
    'submit_rental_request_secure',
    'save_elearning_progress_secure',
    'get_dashboard_stats_secure',
    'get_attendance_logs_secure',
    'get_group_members_secure',
    'insert_feedback_secure',
    'get_feedback_secure',
    'get_financial_records_secure',
    'upsert_financial_record_secure',
    'delete_financial_record_secure',
    'get_system_settings_secure',
    'get_group_assistants_secure',
    'get_assistant_availability_secure',
    'sync_students_to_group_secure',
    'update_group_members_batch_secure',
    'reset_group_plotting_secure',
    'upsert_group_assistant_secure',
    'get_all_group_members_secure',
    'delete_group_assistant_secure',
    'check_pj_absen_today',
    'is_pj_absen_today',
    'get_schedules_secure',
    'get_deletion_history_secure',
    'delete_attendance_log_secure',
    'get_assistant_availability',
    'update_assistant_availability',
    'get_all_availability_for_user_secure',
    'save_assistant_availability_secure',
    'delete_assistant_availability_secure',
    'get_inventory_items_secure',
    'upsert_inventory_item_secure',
    'delete_inventory_item_secure',
    'get_schedule_assignments_secure',
    'upsert_schedule_assignment_secure',
    'delete_schedule_assignment_secure',
    'update_swap_status_secure',
    'approve_swap_secure',
    'update_qr_session_token_secure',
    'upsert_qr_session_secure',
    'stop_qr_session_secure',
    'verify_attendance_secure',
    'get_system_settings_full_secure',
    'get_users_secure',
    'admin_verify_attendance_secure',
    'get_equipment_secure',
    'upsert_equipment_secure',
    'delete_equipment_secure',
    'upsert_schedule_secure',
    'delete_schedule_secure',
    'get_admin_rentals_secure',
    'update_rental_status_secure',
    'upsert_external_link_secure',
    'delete_external_link_secure',
    'save_push_subscription_secure'
  ],
  koordinator: []
};

// ponytail: avoid array duplication using spread operator
ROLE_PERMISSIONS.koordinator = [
  ...ROLE_PERMISSIONS.asisten,
  'admin_create_user',
  'admin_delete_user',
  'admin_update_user',
  'admin_update_system_setting',
  'admin_toggle_user_status',
  'admin_save_division_access',
  'admin_update_global_settings_secure',
  'register_users_batch',
  'sync_class_rosters_secure'
];

// ponytail: lightweight in-memory rate limiter per warm serverless container instance
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const fnName = req.query.fn as string;
  if (!fnName) {
    return res.status(400).json({ error: 'Missing function name' });
  }

  // ponytail: rate limit public auth/registration RPCs to prevent brute-force/spam
  if (['login_user', 'register_user'].includes(fnName)) {
    const ip = (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 60000;
    const maxAttempts = 5;

    if (loginAttempts.size > 1000) {
      for (const [key, val] of loginAttempts.entries()) {
        if (now > val.resetTime) loginAttempts.delete(key);
      }
    }

    const attempt = loginAttempts.get(ip);
    if (attempt) {
      if (now < attempt.resetTime) {
        if (attempt.count >= maxAttempts) {
          return res.status(429).json({ 
            error: "Terlalu banyak percobaan. Silakan coba lagi dalam satu menit." 
          });
        }
        attempt.count++;
      } else {
        loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
      }
    } else {
      loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
    }
  }

  let userId: number | null = null;
  let userRole: string | null = null;

  // Helper: baca token dari httpOnly cookie ATAU Authorization header
  function extractToken(): string | null {
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

  // 1. Verifikasi Keamanan JWT Token (Kecuali RPC Publik)
  if (!PUBLIC_RPCS.includes(fnName)) {
    const token = extractToken();
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing session token' });
    }
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      console.error("JWT_SECRET is missing on the server env");
      return res.status(500).json({ error: 'Server configuration error' });
    }

    let tokenJti: string | undefined;

    try {
      const encodedSecret = new TextEncoder().encode(secretKey);
      const { payload } = await jwtVerify(token, encodedSecret);
      userId = payload.id as number;
      userRole = (payload.role as string || '').toLowerCase();
      tokenJti = payload.jti;
    } catch (err: any) {
      console.warn(`JWT verification failed for RPC ${fnName}:`, err.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    // C-2: Cek token blocklist — tolak token yang sudah di-logout
    if (tokenJti) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseCheck = createClient(supabaseUrl, supabaseServiceKey);
        const { data: isRevoked } = await supabaseCheck.rpc('is_token_revoked', { p_jti: tokenJti });
        if (isRevoked) {
          return res.status(401).json({ error: 'Unauthorized: Session telah berakhir. Silakan login kembali.' });
        }
      }
    }

    // 2. Evaluasi RBAC (Role-Based Access Control)
    if (!userRole || !ROLE_PERMISSIONS[userRole]) {
      return res.status(403).json({ error: 'Forbidden: Peran pengguna tidak valid' });
    }

    const allowedRpcs = ROLE_PERMISSIONS[userRole];
    if (!allowedRpcs.includes('*') && !allowedRpcs.includes(fnName)) {
      console.warn(`RBAC violation: User ${userId} with role ${userRole} tried to call ${fnName}`);
      return res.status(403).json({ error: `Forbidden: Peran Anda (${userRole}) tidak diizinkan memanggil fungsi ini` });
    }
  }

  // 3. Persiapan Parameter dan Pencegahan Spoofing
  // Ambil body yang dikirim oleh client
  const params = { ...(req.body || {}) };

  // Jika user terverifikasi (dari JWT), timpa/suntikkan parameter identitas secara paksa
  if (userId !== null) {
    // ponytail: generic identity parameter injection to prevent spoofing
    const isStaff = userRole === 'asisten' || userRole === 'koordinator';

    if ('p_viewer_id' in params) params['p_viewer_id'] = userId;
    if ('p_caller_id' in params || fnName === 'request_reschedule_secure') params['p_caller_id'] = userId;
    if ('p_student_id' in params) params['p_student_id'] = userId;

    if (!isStaff) {
      // Non-staff (praktikan/penyewa) dipaksa menggunakan ID sendiri untuk parameter identitas user
      if ('p_user_id' in params) params['p_user_id'] = userId;
      if ('p_target_user_id' in params) params['p_target_user_id'] = userId;
      if ('p_target_id' in params) params['p_target_id'] = userId;
    } else {
      // Staff (asisten/koordinator) dipaksa menggunakan ID sendiri untuk RPC spesifik
      if (['check_already_absent_secure', 'get_my_rentals_secure', 'submit_rental_request_secure'].includes(fnName)) {
        if ('p_user_id' in params) params['p_user_id'] = userId;
      }
      // Fix #9: is_pj_absen_today menggunakan p_user_id untuk cek status diri sendiri
      // asisten tidak boleh cek status PJ orang lain
      if (fnName === 'is_pj_absen_today' || fnName === 'check_pj_absen_today') {
        if ('p_user_id' in params) params['p_user_id'] = userId;
      }
    }

    // Kasus khusus get_user_profile: p_caller_id wajib diisi dari JWT
    // p_target_id tetap boleh dari client (untuk lihat profil orang lain, akan dicek di DB)
    if (fnName === 'get_user_profile') {
      params['p_caller_id'] = userId;
      if (!('p_target_id' in params)) {
        params['p_target_id'] = userId;
      }
    }

    // Kasus khusus update_password: hanya koordinator (admin) yang bisa mengubah password orang lain
    if (fnName === 'update_password' && userRole !== 'koordinator') {
      if ('p_target_id' in params) params['p_target_id'] = userId;
    }
  }

  // 4. Eksekusi RPC ke Supabase dengan Service Role Key
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing database environment variables");
    return res.status(500).json({ error: "Server database configuration error" });
  }

  try {
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabaseServer.rpc(fnName, params);

    // ponytail: mask internal database schema/syntax errors to prevent information leakage
    if (error) {
      console.error(`Database Error in RPC [${fnName}]:`, error);
      const isSystemError = /constraint|violates|foreign key|relation|table|syntax|null value|permission denied|does not exist|column|parse/i.test(error.message || '');
      const clientMessage = isSystemError ? `Terjadi kesalahan sistem database: ${error.message}` : error.message;
      return res.status(400).json({ error: clientMessage, details: error.message });
    }

    return res.status(200).json(data);
  } catch (err: any) {
    console.error(`Proxy Exception in RPC [${fnName}]:`, err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
