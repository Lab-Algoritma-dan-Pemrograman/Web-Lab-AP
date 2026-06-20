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
    'save_elearning_progress_secure'
  ],
  penyewa: [
    'get_user_profile',
    'update_user_profile_secure',
    'get_my_rentals_secure',
    'submit_rental_request_secure'
  ],
  asisten: [
    // Asisten mewarisi semua akses praktikan
    'get_user_profile',
    'update_user_profile_secure',
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
    // Spesifik Asisten
    'check_pj_absen_today',
    'is_pj_absen_today',
    'get_attendance_logs_secure',
    'get_schedules_secure',
    'get_deletion_history_secure',
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
    'get_group_members_secure',
    'update_qr_session_token_secure',
    'upsert_qr_session_secure',
    'stop_qr_session_secure',
    'verify_attendance_secure',
    'get_system_settings_full_secure',
    'get_users_secure'
  ],
  koordinator: [
    '*' // Koordinator (admin) memiliki akses ke seluruh RPC
  ]
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const fnName = req.query.fn as string;
  if (!fnName) {
    return res.status(400).json({ error: 'Missing function name' });
  }

  let userId: number | null = null;
  let userRole: string | null = null;

  // 1. Verifikasi Keamanan JWT Token (Kecuali RPC Publik)
  if (!PUBLIC_RPCS.includes(fnName)) {
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

    try {
      const encodedSecret = new TextEncoder().encode(secretKey);
      const { payload } = await jwtVerify(token, encodedSecret);
      userId = payload.id as number;
      userRole = (payload.role as string || '').toLowerCase();
    } catch (err: any) {
      console.warn(`JWT verification failed for RPC ${fnName}:`, err.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
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
    // Timpa p_viewer_id jika terdapat di parameter atau jika fungsi bertindak sebagai get/view
    if ('p_viewer_id' in params) {
      params['p_viewer_id'] = userId;
    }
    
    // Timpa p_caller_id jika terdapat di parameter
    if ('p_caller_id' in params) {
      params['p_caller_id'] = userId;
    }

    // Kasus khusus get_user_profile: p_caller_id wajib diisi dari JWT
    // p_target_id tetap boleh dari client (untuk lihat profil orang lain, akan dicek di DB)
    if (fnName === 'get_user_profile') {
      params['p_caller_id'] = userId;
      // Jika p_target_id tidak dikirim, default ke profil sendiri
      if (!('p_target_id' in params)) {
        params['p_target_id'] = userId;
      }
    }

    // Kasus khusus check_already_absent_secure atau rpc sejenis yang memakai p_user_id untuk diri sendiri
    if (fnName === 'check_already_absent_secure' && 'p_user_id' in params) {
      params['p_user_id'] = userId;
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

    if (error) {
      console.error(`Database Error in RPC [${fnName}]:`, error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err: any) {
    console.error(`Proxy Exception in RPC [${fnName}]:`, err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
