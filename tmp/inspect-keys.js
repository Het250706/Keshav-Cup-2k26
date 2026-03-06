const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: teams } = await supabase.from('teams').select('*').limit(1);
    console.log('Team keys:', Object.keys(teams[0]));

    const { data: players } = await supabase.from('players').select('*').limit(1);
    if (players && players.length > 0) {
        console.log('Player keys:', Object.keys(players[0]));
    }
}

check();
