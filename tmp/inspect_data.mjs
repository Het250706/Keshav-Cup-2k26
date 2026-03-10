
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key missing in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('--- TEAMS ---');
    const { data: teams, error: teamsError } = await supabase.from('teams').select('*');
    if (teamsError) {
        console.error('Error fetching teams:', teamsError);
    } else {
        console.table(teams.map(t => ({ id: t.id, name: t.name })));
    }

    console.log('\n--- PLAYERS ASSIGNED TO TEAMS ---');
    const { data: players, error: playersError } = await supabase.from('players').select('id, first_name, last_name, team_id, sold_team');
    if (playersError) {
        console.error('Error fetching players:', playersError);
    } else {
        // Count players per team
        const counts = {};
        players.forEach(p => {
            const teamKey = p.team_id || p.sold_team || 'Unassigned';
            counts[teamKey] = (counts[teamKey] || 0) + 1;
        });
        console.log('Player counts per team/ID:');
        console.log(counts);

        const astikayamPlayers = players.filter(p =>
            p.sold_team === 'ASTIKAYAM' ||
            (teams && teams.find(t => t.name === 'ASTIKAYAM' && t.id === p.team_id))
        );
        console.log(`\nPlayers for ASTIKAYAM: ${astikayamPlayers.length}`);
        if (astikayamPlayers.length > 0) {
            console.table(astikayamPlayers);
        } else {
            console.log('No players found with sold_team="ASTIKAYAM" or team_id matching ASTIKAYAM team ID.');
        }

        // Check for typos
        const uniqueSoldTeams = Array.from(new Set(players.map(p => p.sold_team).filter(Boolean)));
        console.log('\nUnique sold_team values in players table:', uniqueSoldTeams);
    }
}

inspect();
