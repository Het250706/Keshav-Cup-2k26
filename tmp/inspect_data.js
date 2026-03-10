
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Simple parser for .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim().replace(/^"|"$/g, '');
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key missing in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    try {
        console.log('--- TEAMS ---');
        const { data: teams, error: teamsError } = await supabase.from('teams').select('*');
        if (teamsError) {
            console.error('Error fetching teams:', teamsError);
        } else {
            console.log(JSON.stringify(teams, null, 2));
        }

        console.log('\n--- PLAYERS FOR ASTIKAYAM ---');
        // Search by sold_team name
        const { data: playersByName, error: p1Error } = await supabase.from('players').select('*').eq('sold_team', 'ASTIKAYAM');
        console.log(`Players with sold_team="ASTIKAYAM": ${playersByName?.length || 0}`);

        // Search by team_id
        if (teams) {
            const asti = teams.find(t => t.name.includes('ASTIKAYAM'));
            if (asti) {
                console.log(`Found team ASTIKAYAM with ID: ${asti.id}`);
                const { data: playersById, error: p2Error } = await supabase.from('players').select('*').eq('team_id', asti.id);
                console.log(`Players with team_id="${asti.id}": ${playersById?.length || 0}`);
            } else {
                console.log('No team found named "ASTIKAYAM"');
            }
        }

        console.log('\n--- ALL SOLD PLAYERS ---');
        const { data: allSold, error: p3Error } = await supabase.from('players').select('first_name, last_name, sold_team, team_id').not('sold_team', 'is', null);
        console.log('Sold players:');
        console.table(allSold);

    } catch (e) {
        console.error('Script error:', e);
    }
}

inspect();
