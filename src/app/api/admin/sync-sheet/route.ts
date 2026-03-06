import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID;
        const apiKey = process.env.sheet_ideets_api_key;

        if (!sheetId || !apiKey) {
            return NextResponse.json({ error: 'Google Sheet configuration missing' }, { status: 500 });
        }

        // Fetch sheet data (assuming first sheet, first few columns)
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:Z?key=${apiKey}`;
        const sheetRes = await fetch(url);
        const sheetData = await sheetRes.json();

        if (!sheetData.values || sheetData.values.length < 2) {
            return NextResponse.json({ count: 0, message: 'No data found in sheet' });
        }

        const rows = sheetData.values.slice(1); // Skip header
        let newCount = 0;

        for (const row of rows) {
            let first_name, last_name, email, role, category, base_price, photo_url, age, city, batting_style;

            if (row.length >= 5 && !row[1]?.includes('@')) {
                // Manual format: [FirstName, LastName, Role, Category, BasePrice, PhotoURL, Age, City, Style]
                [first_name, last_name, role, category, base_price, photo_url, age, city, batting_style] = row;
                email = `${first_name?.toLowerCase()}.${last_name?.toLowerCase()}@local.com`;
                base_price = parseInt(base_price) || 20000000;
            } else {
                // Google Form format: [Timestamp, Email, FirstName, LastName, Role, Category, PhotoURL, Age, City, Style]
                [, email, first_name, last_name, role, category, photo_url, age, city, batting_style] = row;
                base_price = 20000000;
                if (category === 'Platinum') base_price = 80000000;
                if (category === 'Gold') base_price = 50000000;
                if (category === 'Silver') base_price = 30000000;
            }

            if (!first_name || !last_name) continue;

            const { data: existing } = await supabase
                .from('players')
                .select('id')
                .or(`email.eq.${email},and(first_name.eq.${first_name},last_name.eq.${last_name})`)
                .maybeSingle();

            if (!existing) {
                const { error: insError } = await supabase.from('players').insert([{
                    first_name,
                    last_name,
                    email,
                    role: role || 'Batsman',
                    category: category || 'Silver',
                    base_price: Number(base_price) || 20000000,
                    photo_url: photo_url || '',
                    age: Number(age) || 20,
                    city: city || 'Local',
                    batting_style: batting_style || 'Right Handed',
                    auction_status: 'pending'
                }]);
                if (!insError) newCount++;
            }
        }

        return NextResponse.json({ count: newCount });
    } catch (error: any) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
