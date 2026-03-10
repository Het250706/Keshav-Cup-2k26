
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
    const results = {};
    try {
        const { data: teams } = await supabase.from('teams').select('*');
        results.teams = teams.map(t => ({ name: t.name, id: t.id }));

        const { data: players } = await supabase.from('players').select('first_name, last_name, sold_team, team_id');
        results.totalPlayers = players.length;

        const countsBySoldTeam = {};
        players.forEach(p => {
            if (p.sold_team) {
                countsBySoldTeam[p.sold_team] = (countsBySoldTeam[p.sold_team] || 0) + 1;
            }
        });
        results.countsBySoldTeam = countsBySoldTeam;

        const astikayamPlayers = players.filter(p => p.sold_team === 'ASTIKAYAM' || (teams && teams.find(t => t.name === 'ASTIKAYAM' && t.id === p.team_id)));
        results.astikayamPlayers = astikayamPlayers;

        fs.writeFileSync('tmp/inspect_results.json', JSON.stringify(results, null, 2));
        console.log('Results written to tmp/inspect_results.json');
    } catch (e) {
        console.error(e);
    }
}

inspect();
