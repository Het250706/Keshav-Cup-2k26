import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wlhevrdapbgkeiqutmni.supabase.co';
const supabaseKey = 'sb_publishable_UZwGs9_bYZshbaOyRH2I_Q_9UB1udxV';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectPlayersTable() {
    // Attempting to get a single row to see columns
    const { data, error } = await supabase.from('players').select('*').limit(1);

    if (error) {
        console.error('Error fetching from players:', error);
        // If select * fails or table empty, try to get column names via an insert that fails? No, better use a known method.
        // Actually if it's empty, data will be []
    }

    if (data) {
        if (data.length > 0) {
            console.log('Columns:', Object.keys(data[0]).join(', '));
        } else {
            console.log('Table is empty. Checking schema via query...');
            // In public Supabase, we can't easily query information_schema via RPC unless defined.
            // But we can try to insert a dummy row and see what happens or just guess from previous attempts.
        }
    }
}

inspectPlayersTable();
