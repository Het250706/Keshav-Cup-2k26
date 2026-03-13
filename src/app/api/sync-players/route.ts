import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { migrateDriveImageToSupabase } from '@/lib/drive-to-supabase';

export async function POST() {
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    const RANGE = 'Sheet1!A2:H'; // Adjust based on sheet structure

    if (!SHEET_ID || !API_KEY) {
        return NextResponse.json({ error: 'Google Sheets configuration missing' }, { status: 500 });
    }

    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.values) {
            const players = await Promise.all(data.values.map(async (row: any) => {
                const name = row[0];
                const originalPhotoUrl = row[6];
                
                // Migrate to Supabase
                const finalPhotoUrl = await migrateDriveImageToSupabase(originalPhotoUrl, name || 'unknown');

                return {
                    name: name,
                    age: parseInt(row[1]),
                    role: row[2],
                    base_price: parseFloat(row[3]),
                    city: row[4],
                    phone: row[5],
                    photo_url: finalPhotoUrl,
                    category: row[7] || 'Silver'
                };
            }));

            // Bulk upsert into Supabase
            const { error } = await supabase.from('players').upsert(players, { onConflict: 'name' });

            if (error) throw error;

            return NextResponse.json({ success: true, count: players.length });
        }

        return NextResponse.json({ success: true, count: 0 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
