
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
    console.log('🧐 DEEP SCAN...');
    
    // 1. Get raw rows
    const { data: rows, error: err1 } = await supabase.from('players').select('*');
    console.log('Rows count:', rows?.length || 0);
    if (err1) console.error('Error 1:', err1);

    // 2. Get with count option
    const { data: cData, count, error: err2 } = await supabase
        .from('players')
        .select('*', { count: 'exact' });
    console.log('Select count:', count);
    if (err2) console.error('Error 2:', err2);
    
    if (rows) {
        rows.forEach(r => console.log(`ID: ${r.id}, Name: ${r.first_name}, Photo: ${r.photo_url}`));
    }
}

check();
