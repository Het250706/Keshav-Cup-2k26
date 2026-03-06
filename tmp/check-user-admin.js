const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local relative to script location
const envPath = path.resolve(__dirname, '../.env.local');
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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function checkUser() {
    console.log('Checking for user: divyam@keshav.com using SERVICE ROLE KEY...');
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
        console.error('Error listing users:', error);
        return;
    }

    const { users } = data;
    const user = users.find(u => u.email === 'divyam@keshav.com');
    if (user) {
        console.log('User found:', {
            id: user.id,
            email: user.email,
            metadata: user.user_metadata
        });
    } else {
        console.log('User NOT found.');
        console.log('Total users:', users.length);
        console.log('User emails:', users.map(u => u.email));
    }
}

checkUser();
