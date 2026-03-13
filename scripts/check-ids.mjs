
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
    console.log('🧐 TRYING ID SELECT...');
    
    // Attempting to bypass any potential column issues
    const { data, error } = await supabase
        .from('players')
        .select('id');
    
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('IDs found:', data);
    }
}

check();
