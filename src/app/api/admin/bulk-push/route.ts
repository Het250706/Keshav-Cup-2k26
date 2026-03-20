import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
    try {
        console.log('--- BULK RE-PUSH ALL PLAYERS FROM GOOGLE SHEET ---');

        // 1. Fetch all registrations from Google Sheet
        const sheetId = process.env.GOOGLE_SHEET_ID || '1ZHD222skktQspk97xv-s5T2uUa09t7SOIGmxtaICUHA';
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.statusText}`);

        const text = await res.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
        if (!match) throw new Error('Invalid response format from Google Sheets');

        const json = JSON.parse(match[1]);
        if (!json.table || !json.table.rows) throw new Error('Unexpected JSON structure');

        const rows = json.table.rows;
        const sheetPlayers = rows.map((row: any, index: number) => {
            const c = row.c;
            const getValue = (i: number) => {
                if (!c || !c[i]) return '';
                const cell = c[i];
                const val = cell.f || cell.v;
                return val === null || val === undefined ? '' : String(val);
            };

            // NEW MAPPING BASED ON SYNC-SHEET:
            // 2: Full Name, 3: Mo. no., 6: Photo, 7: Participation, 8: Skill, 9: Birth Date
            const fullName = getValue(2);
            const mobile = getValue(3);
            let photoUrl = getValue(6);
            const participation = getValue(7);
            const skill = getValue(8);

            if (photoUrl && (photoUrl.includes('drive.google.com') || photoUrl.includes('docs.google.com/uc'))) {
                const fileIdMatch = photoUrl.match(/[-\w]{25,}/);
                if (fileIdMatch) {
                    photoUrl = `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}`;
                }
            }

            return {
                fullName,
                mobile,
                skill,
                participation,
                photo: photoUrl
            };
        }).filter((p: any) => p.fullName && p.fullName.trim() !== '' && p.fullName !== 'Full Name:');

        console.log(`Found ${sheetPlayers.length} players in Google Sheet`);

        // 2. Use service role to bypass RLS
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 3. Check which players already exist in DB
        const { data: existingPlayers } = await supabaseAdmin.from('players').select('first_name, last_name, phone');
        const existingNames = new Set(
            (existingPlayers || []).map((p: any) => `${p.first_name} ${p.last_name}`.toLowerCase().trim())
        );
        const existingPhones = new Set(
            (existingPlayers || []).map((p: any) => String(p.phone).trim())
        );

        // 4. Insert only new players
        let pushed = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const sp of sheetPlayers) {
            const fullName = sp.fullName.trim();
            const mobile = sp.mobile.trim();

            if (existingNames.has(fullName.toLowerCase()) || (mobile && existingPhones.has(mobile))) {
                skipped++;
                continue;
            }

            const nameParts = fullName.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || 'Player';

            const { error } = await supabaseAdmin.from('players').insert([{
                first_name: firstName,
                last_name: lastName,
                phone: mobile,
                cricket_skill: sp.skill || 'All-rounder',
                role: sp.skill || 'All-rounder',
                was_present_kc3: sp.participation || 'No',
                photo_url: sp.photo || '',
                base_price: 20000000,
                category: 'Unassigned',
                auction_status: 'pending'
            }]);

            if (error) {
                console.error(`Failed to push ${fullName}:`, error.message);
                errors.push(`${fullName}: ${error.message}`);
            } else {
                pushed++;
                existingNames.add(fullName.toLowerCase());
                if (mobile) existingPhones.add(mobile);
            }
        }

        console.log(`Pushed: ${pushed}, Skipped: ${skipped}, Errors: ${errors.length}`);

        return NextResponse.json({
            success: true,
            pushed,
            skipped,
            total: sheetPlayers.length,
            errors: errors.length > 0 ? errors : undefined,
            message: `Restored ${pushed} players from the NEW Google Sheet. ${skipped} skipped (already exist).`
        });

    } catch (err: any) {
        console.error('Bulk Push Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
