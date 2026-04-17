
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    console.log("--- INSPECTING SCHEMA ---");
    
    // Check Inventory Items
    const { data: invColumns, error: invError } = await supabase.rpc('get_inventory_items_secure', { p_viewer_id: 1 });
    console.log("Inventory Sample:", invColumns ? invColumns[0] : "Empty or Error: " + invError?.message);

    // Check Users
    const { data: userColumns, error: userError } = await supabase.rpc('get_users_secure', { p_viewer_id: 1 });
    console.log("User Sample:", userColumns ? userColumns[0] : "Empty or Error: " + userError?.message);

    // Check Group Members
    const { data: groupData } = await supabase.from('group_members').select('*').limit(1);
    console.log("Group Members Schema Sample:", groupData ? Object.keys(groupData[0]) : "No data");
}

// Note: This won't run here directly, but I'll use it as a reference or if the user allowed execution.
