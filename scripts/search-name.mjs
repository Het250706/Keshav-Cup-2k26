
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
    console.log('🧐 SEARCHING BY NAME...');
    
    const { data: p1, error: e1 } = await supabase.from('players').select('*').ilike('first_name', '%het%');
    console.log('Het search:', p1, e1);

    const { data: p2, error: e2 } = await supabase.from('players').select('*').ilike('last_name', '%patel%');
    console.log('Patel search:', p2, e2);
}

check();
