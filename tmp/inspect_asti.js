
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
        const { data: teams } = await supabase.from('teams').select('*');
        console.log('TEAMS FOUND:', teams.length);
        teams.forEach(t => console.log(`TEAM: ${t.name} (ID: ${t.id})`));

        const { data: players } = await supabase.from('players').select('first_name, last_name, sold_team, team_id');
        console.log('\nTOTAL PLAYERS:', players.length);

        const countsBySoldTeam = {};
        players.forEach(p => {
            if (p.sold_team) {
                countsBySoldTeam[p.sold_team] = (countsBySoldTeam[p.sold_team] || 0) + 1;
            }
        });

        console.log('\nPLAYERS PER SOLD_TEAM:');
        Object.entries(countsBySoldTeam).forEach(([team, count]) => {
            console.log(`${team}: ${count}`);
        });

        const astikayamPlayers = players.filter(p => p.sold_team === 'ASTIKAYAM' || (teams && teams.find(t => t.name === 'ASTIKAYAM' && t.id === p.team_id)));
        console.log('\nASTIKAYAM DETAILED PLAYERS:', astikayamPlayers.length);
        astikayamPlayers.forEach(p => console.log(`- ${p.first_name} ${p.last_name} (${p.sold_team || 'No Sold Team'})`));

    } catch (e) {
        console.error(e);
    }
}

inspect();
