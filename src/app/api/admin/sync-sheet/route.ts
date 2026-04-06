import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    console.log('--- SYNC SHEET CALLED ---');
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID || '1pfeRG8b7dbrt3cuVErSRpnwrmwMOH8AgsQla_NPTs_E';
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;

        console.log('Fetching from URL:', url);
        const response = await fetch(url, { cache: 'no-store' });
        const text = await response.text();
        
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
        if (!match) return NextResponse.json({ error: 'Invalid response format' }, { status: 500 });

        const jsonStr = match[1];
        const data = JSON.parse(jsonStr);
        const rows = data.table.rows;

        if (!rows || rows.length === 0) return NextResponse.json({ message: 'No rows found', count: 0 });

        let syncedCount = 0;
        let updatedCount = 0;
        let poolExistsCount = 0;

        for (const row of rows) {
            const c = row.c;
            if (!c || c.length < 5) continue;

            const getValue = (i: number) => {
                if (!c[i]) return '';
                return c[i].f || c[i].v || '';
            };

            // NEW USER MAPPING FROM GOOGLE SHEET:
            // 1: યુવક સભા, 2: Full Name, 3: Mobile, 4: Address, 5: કાર્યકર, 
            // 6: Birth Date, 7: Occupation, 8: Photo URL, 9: કેશવ કપ, 10: Cricket Skill,
            // 11: T-shirt Size, 12: T-shirt number
            
            const yuvaSabha = String(getValue(1)).trim();
            const fullName = String(getValue(2)).trim();
            const mobile = String(getValue(3)).trim();
            const address = String(getValue(4)).trim();
            const areaContact = String(getValue(5)).trim();
            const birthDate = String(getValue(6)).trim();
            const occupation = String(getValue(7)).trim();
            const photoUrl = String(getValue(8));
            const participation = String(getValue(9));
            const skill = String(getValue(10));
            const tshirtSize = String(getValue(11));
            const tshirtNumber = String(getValue(12));

            if (!fullName || fullName === 'Full Name' || !mobile) continue;

            // Age Calculation
            let age = 20;
            if (birthDate) {
                if (birthDate.startsWith('Date(')) {
                    const matchAge = birthDate.match(/Date\((\d+),/);
                    if (matchAge) age = 2026 - parseInt(matchAge[1]);
                } else {
                    // Try to parse YYYY-MM-DD
                    const yearMatch = birthDate.match(/^(\d{4})/);
                    if (yearMatch) age = 2026 - parseInt(yearMatch[1]);
                }
            }

            // NEW ROBUST GOOGLE DRIVE CONVERSION
            let finalPhoto = photoUrl;
            if (photoUrl.includes('drive.google.com') || photoUrl.includes('googleusercontent.com')) {
                const fileIdMatch = photoUrl.match(/[-\w]{25,}/);
                if (fileIdMatch) {
                    finalPhoto = `https://drive.google.com/uc?export=view&id=${fileIdMatch[0]}`;
                }
            }

            // Check if already in Player Pool (players table) - If so, we ignore it to avoid confusion
            const { data: inPool } = await supabaseAdmin.from('players').select('id').eq('phone', mobile).maybeSingle();
            if (inPool) {
                poolExistsCount++;
                continue;
            }

            // Check if already in Registration Control (registrations table)
            const { data: existingReg } = await supabaseAdmin
                .from('registrations')
                .select('id')
                .or(`mobile.eq."${mobile}",name.eq."${fullName}"`)
                .maybeSingle();

            const regData = {
                name: fullName,
                mobile: mobile,
                age: age,
                role: skill || 'All-rounder',
                city: participation || 'No', // Following existing convention for participation
                photo: finalPhoto,
                base_price: 20000000, // Default 0.20 Cr
                yuva_sabha: yuvaSabha,
                address: address,
                area_contact: areaContact,
                birth_date: birthDate,
                occupation: occupation,
                tshirt_size: tshirtSize,
                tshirt_number: tshirtNumber
            };

            if (existingReg) {
                // Update Existing
                const { error: updateError } = await supabaseAdmin
                    .from('registrations')
                    .update(regData)
                    .eq('id', existingReg.id);
                
                if (!updateError) updatedCount++;
            } else {
                // Insert New
                const { error: insertError } = await supabaseAdmin
                    .from('registrations')
                    .insert([regData]);
                
                if (!insertError) syncedCount++;
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Sync complete. New: ${syncedCount}, Updated: ${updatedCount}, Already in Pool: ${poolExistsCount}`,
            synced: syncedCount,
            updated: updatedCount,
            inPool: poolExistsCount
        });

    } catch (err: any) {
        console.error('Sync error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
