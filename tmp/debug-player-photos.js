
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

function getEnv() {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const env = {};
    envFile.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            env[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
    });
    return env;
}

const env = getEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlayers() {
    const { data, error } = await supabase.from('players').select('first_name, last_name, photo_url');
    if (error) {
        console.error('Error fetching players:', error);
        return;
    }

    const het = data.find(p => p.first_name.includes('Het'));
    if (het) {
        console.log(`URL_FOR_HET: ${het.photo_url}`);
    } else {
        console.log('Het not found');
    }
}

checkPlayers();
