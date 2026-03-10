import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wlhevrdapbgkeiqutmni.supabase.co';
const supabaseKey = 'sb_publishable_UZwGs9_bYZshbaOyRH2I_Q_9UB1udxV';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseState() {
    console.log('--- Checking Players Columns ---');
    const { data: players, error: pErr } = await supabase.from('players').select('*').limit(1);
    if (pErr) console.error('Players Error:', pErr.message);
    else console.log('Player Columns:', Object.keys(players[0] || {}).join(', '));

    console.log('\n--- Checking Sold Players ---');
    const { data: soldPlayers, error: sErr } = await supabase.from('players').select('first_name, last_name, sold_team, team_id').not('auction_status', 'eq', 'pending');
    if (sErr) console.error('Sold Players Error:', sErr.message);
    else console.log('Sold Players count:', soldPlayers?.length, 'Details:', JSON.stringify(soldPlayers?.slice(0, 5), null, 2));

    console.log('\n--- Checking Teams ---');
    const { data: teams, error: tErr } = await supabase.from('teams').select('id, name');
    if (tErr) console.error('Teams Error:', tErr.message);
    else console.log('Teams count:', teams?.length, 'Sample:', JSON.stringify(teams?.slice(0, 2), null, 2));
}

checkDatabaseState();
