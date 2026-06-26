import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET method (Vercel crons send GET requests by default)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Secure the cron endpoint to verify it is called by Vercel Cron
  // In development/local environment, we skip this check
  if (process.env.NODE_ENV === 'production' && req.headers['x-vercel-cron'] !== '1') {
    return res.status(401).json({ error: 'Unauthorized: Access restricted to Vercel Cron only' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing database environment variables for keep-alive");
    return res.status(500).json({ error: "Server database configuration error" });
  }

  try {
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
    
    // Call the lightweight get_public_settings RPC to ping the database
    const { data, error } = await supabaseServer.rpc('get_public_settings');

    if (error) {
      console.error("Keep-alive database ping error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Supabase pinged successfully', 
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("Keep-alive exception:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
