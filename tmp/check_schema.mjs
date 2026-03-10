import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .limit(1);

    if (error) {
        console.error('ERROR FETCHING PLAYERS:', error);
    } else {
        console.log('PLAYER COLUMNS:', Object.keys(data[0] || {}));
    }
}

check();
