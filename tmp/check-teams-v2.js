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

async function checkTeams() {
    const { data, error } = await supabase.from('teams').select('*').limit(1);
    if (error) {
        console.log('Error fetching teams:', error.message);
        return;
    }
    console.log('Team columns:', Object.keys(data[0] || {}));
}

checkTeams();
