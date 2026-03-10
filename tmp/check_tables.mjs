import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wlhevrdapbgkeiqutmni.supabase.co';
const supabaseKey = 'sb_publishable_UZwGs9_bYZshbaOyRH2I_Q_9UB1udxV';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    const { error: err1 } = await supabase.from('matches').select('id').limit(1);
    const { error: err2 } = await supabase.from('innings').select('id').limit(1);
    const { error: err3 } = await supabase.from('teams').select('id').limit(1);

    console.log('Matches table check:', err1 ? err1.message : 'Exists');
    console.log('Innings table check:', err2 ? err2.message : 'Exists');
    console.log('Teams table check:', err3 ? err3.message : 'Exists');
}

checkTables();
