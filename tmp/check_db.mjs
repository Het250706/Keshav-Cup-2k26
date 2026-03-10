import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wlhevrdapbgkeiqutmni.supabase.co';
const supabaseKey = 'sb_publishable_UZwGs9_bYZshbaOyRH2I_Q_9UB1udxV';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatches() {
    const { data: cols, error: err } = await supabase.from('matches').select('*').limit(1);
    if (err) {
        console.error('Error fetching matches:', err);
    } else {
        console.log('Columns in matches table:', Object.keys(cols[0] || {}).join(', '));
        console.log('Sample row:', cols[0]);
    }
}

checkMatches();
