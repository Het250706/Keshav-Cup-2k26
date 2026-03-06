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
    const { data: state, error: stateError } = await supabase.from('auction_state').select('*');
    console.log('Auction State:', state);

    const { data: columns, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'auction_state' });
    // If RPC doesn't exist, we might need another way to check schema
    if (colError) console.log('RPC get_table_columns failed, checking via select');

    const { data: bids, error: bidsError } = await supabase.from('bids').select('*').limit(5);
    console.log('Recent Bids:', bids);
}

check();
