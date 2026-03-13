
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Manually load .env.local since this is a standalone script
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/**
 * Simplified migration logic for standalone script
 */
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
        
        // Handle Google virus scan warning
        let content = await response.text();
        if (content.includes('confirm=') || (response.headers.get('content-type') || '').includes('text/html')) {
            const match = content.match(/confirm=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                const confirmedUrl = `${downloadUrl}&confirm=${match[1]}`;
                response = await fetch(confirmedUrl);
            } else if (content.includes('<!DOCTYPE html') || content.includes('<html')) {
                console.error(`Failed to download ${playerName}: Permission denied or HTML warning.`);
                return url;
            }
        } else {
            response = await fetch(downloadUrl);
        }

        if (!response.ok) return url;

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        // Final filename should be player-id.jpg
        const fileName = playerName; 

        const { error: uploadError } = await supabaseAdmin.storage
            .from('player-photos')
            .upload(fileName, buffer, {
                contentType: contentType,
                upsert: true
            });

        if (uploadError) {
            console.error(`Upload error for ${playerName}:`, uploadError.message);
            return url;
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('player-photos')
            .getPublicUrl(fileName);

        return publicUrl;
    } catch (err) {
        console.error(`Fetch error for ${playerName}:`, err.message);
        return url;
    }
}

async function runMigration() {
    console.log('🚀 Starting Standalone Photo Migration (No Dev Server Needed)...');

    try {
        // 1. Fetch all players
        const { data: players, error: fetchError } = await supabaseAdmin
            .from('players')
            .select('id, photo_url');

        if (fetchError) throw fetchError;

        if (!players || players.length === 0) {
            console.log('✅ No players found to migrate.');
            return;
        }

        console.log(`📊 Found ${players.length} players. Processing...`);

        let migratedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        const FORCE_RE_MIGRATE = true; // Set to true to overwrite corrupted links

        for (const player of players) {
            const currentUrl = player.photo_url || '';
            
            // Skip ONLY IF it's a valid Supabase URL and we are not forcing a re-migration
            if (!currentUrl || (currentUrl.includes('.supabase.co') && !FORCE_RE_MIGRATE)) {
                skippedCount++;
                continue;
            }

            // We need a way to get the original Google URL if we are forcing...
            // But we lost it. So for now, we only migrate Google links.
            if (currentUrl.includes('google')) {
                const filename = `${player.id}.jpg`;
                const newUrl = await migrateDriveImageToSupabase(currentUrl, filename);

                if (newUrl && newUrl !== currentUrl) {
                    const { error: updateError } = await supabaseAdmin
                        .from('players')
                        .update({ photo_url: newUrl })
                        .eq('id', player.id);

                    if (updateError) {
                        console.error(`❌ DB Update failed for ${player.id}`);
                        failedCount++;
                    } else {
                        console.log(`✅ Migrated player ${player.id}`);
                        migratedCount++;
                    }
                } else {
                    failedCount++;
                }
            } else {
                skippedCount++;
            }
        }

        console.log('\n--- Migration Summary ---');
        console.log(`✅ Successfully Migrated: ${migratedCount}`);
        console.log(`⏭️  Skipped (already done): ${skippedCount}`);
        console.log(`❌ Failed: ${failedCount}`);
        console.log('-------------------------\n');

    } catch (error) {
        console.error('❌ Fatal Migration Error:', error.message);
    }
}

runMigration();
