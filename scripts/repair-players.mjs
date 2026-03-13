
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

const supabaseAdmin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateDriveImageToSupabase(url, playerName) {
    if (!url || !url.includes('google')) return url;

    try {
        let driveId = '';
        if (url.includes('id=')) {
            driveId = url.split('id=')[1].split('&')[0];
        } else if (url.includes('/d/')) {
            const parts = url.split('/d/');
            if (parts.length > 1) {
                driveId = parts[1].split('/')[0].split('?')[0].split('=')[0];
            }
        } else if (url.includes('open?id=')) {
            driveId = url.split('open?id=')[1].split('&')[0];
        }

        if (!driveId) return url;

        const downloadUrl = `https://docs.google.com/uc?export=download&id=${driveId}`;
        let response = await fetch(downloadUrl);
        
        let content = await response.text();
        if (content.includes('confirm=') || (response.headers.get('content-type') || '').includes('text/html')) {
            const match = content.match(/confirm=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                const confirmedUrl = `${downloadUrl}&confirm=${match[1]}`;
                response = await fetch(confirmedUrl);
            } else if (content.includes('<!DOCTYPE html') || content.includes('<html')) {
                console.error(`Failed to download ${playerName}: Google Drive returned a permission or warning page.`);
                return url;
            }
        } else {
            response = await fetch(downloadUrl);
        }

        if (!response.ok) return url;

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        const fileName = `${playerName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('player-photos')
            .upload(fileName, buffer, {
                contentType: contentType,
                upsert: true
            });

        if (uploadError) return url;

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('player-photos')
            .getPublicUrl(fileName);

        return publicUrl;
    } catch (err) {
        console.error('Error:', err.message);
        return url;
    }
}

async function repair() {
    console.log('🛠️ REPAIRING PLAYERS...');
    
    // Recovery data Found in sheet
    const repairs = [
        { name: 'het', driveUrl: 'https://drive.google.com/open?id=1-v78d21K47TpAD1nd-6biDGXy0BRfMFw' }
    ];

    for (const r of repairs) {
        // Find player ID in DB
        const { data: p } = await supabaseAdmin.from('players').select('id').ilike('first_name', `%${r.name}%`).maybeSingle();
        
        if (p) {
            console.log(`Repairing ${r.name} (ID: ${p.id})...`);
            const newUrl = await migrateDriveImageToSupabase(r.driveUrl, `${p.id}.jpg`);
            
            if (newUrl.includes('.supabase.co')) {
                await supabaseAdmin.from('players').update({ photo_url: newUrl }).eq('id', p.id);
                console.log(`✅ Successfully repaired ${r.name}`);
            } else {
                console.log(`❌ Still failing to migrate ${r.name}`);
            }
        } else {
            console.log(`⚠️ Player ${r.name} not found in database to repair.`);
        }
    }
}

repair();
