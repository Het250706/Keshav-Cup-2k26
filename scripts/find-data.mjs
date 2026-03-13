
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
    console.log('🧐 FINDING DATA...');
    
    const tables = ['players', 'teams', 'auction_state', 'bids', 'registrations'];
    
    for (const table of tables) {
        const { data, count, error } = await supabase.from(table).select('*', { count: 'exact' });
        console.log(`Table ${table}: ${data?.length || 0} rows (count: ${count})`);
        if (data && data.length > 0 && table === 'players') {
            fs.writeFileSync('photo_url_debug.txt', data[0].photo_url || 'NULL');
            console.log('Photo URL written to photo_url_debug.txt');
        }
    }
}

check();
