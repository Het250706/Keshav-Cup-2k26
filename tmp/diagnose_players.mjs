import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wlhevrdapbgkeiqutmni.supabase.co';
const supabaseKey = 'sb_publishable_UZwGs9_bYZshbaOyRH2I_Q_9UB1udxV';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseState() {
    const { data: players } = await supabase.from('players').select('*').limit(1);
    if (players && players[0]) {
        console.log('PLAYER_COLUMNS: ' + Object.keys(players[0]).join(', '));
    } else {
        console.log('NO_PLAYERS_FOUND');
    }

    const { data: soldPlayers } = await supabase.from('players').select('*').limit(5);
    console.log('PLAYER_DATA_SAMPLE: ' + JSON.stringify(soldPlayers));
}

checkDatabaseState();
