
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
});

const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    console.log('🧐 DEBUGGING DATABASE CONNECTION...');
    console.log('Project URL:', env.NEXT_PUBLIC_SUPABASE_URL);

    // List all tables
    const { data: tables, error: tableError } = await supabase
        .from('players')
        .select('count');
    
    console.log('Players Count Result:', tables, tableError);

    // Try another table
    const { data: teams, error: teamError } = await supabase
        .from('teams')
        .select('count');
    console.log('Teams Count Result:', teams, teamError);
}

check();
