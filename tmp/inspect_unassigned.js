
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
        env[key] = value;
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    try {
        const { data: players } = await supabase.from('players').select('first_name, last_name, sold_team, team_id');
        const unassigned = players.filter(p => !p.sold_team && !p.team_id);

        console.log(`TOTAL PLAYERS: ${players.length}`);
        console.log(`UNASSIGNED PLAYERS: ${unassigned.length}`);
        if (unassigned.length > 0) {
            unassigned.slice(0, 5).forEach(p => console.log(`- ${p.first_name} ${p.last_name}`));
        }

        const allSoldTeams = Array.from(new Set(players.map(p => p.sold_team).filter(Boolean)));
        console.log(`SOLD TEAMS IN DB: ${allSoldTeams.join(', ')}`);

    } catch (e) {
        console.error(e);
    }
}

inspect();
