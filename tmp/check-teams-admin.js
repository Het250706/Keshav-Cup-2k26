const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.join('=').trim();
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTeams() {
    console.log('Fetching teams from DB using SERVICE ROLE KEY...');
    const { data, error } = await supabase.from('teams').select('*');
    if (error) {
        console.error('Error fetching teams:', error);
        return;
    }
    console.log('Teams count:', data.length);
    if (data.length > 0) {
        console.log('Teams list:', data.map(t => t.team_name));
    } else {
        console.log('No teams found in the "teams" table.');
    }
}

checkTeams();
