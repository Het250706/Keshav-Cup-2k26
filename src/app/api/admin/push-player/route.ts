import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { migrateDriveImageToSupabase } from '@/lib/drive-to-supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { player } = body;

        if (!player) {
            return NextResponse.json({ error: 'No player data provided' }, { status: 400 });
        }

        // Migrate image if it's from Google Drive
        const migratingName = `${player.first_name}_${player.last_name}`;
        const finalPhotoUrl = await migrateDriveImageToSupabase(player.photo_url || '', migratingName);

        // Use SERVICE ROLE KEY to bypass RLS and ensure the push works
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Standardize the push
        const { data, error } = await supabaseAdmin
            .from('players')
            .insert([{
                first_name: player.first_name,
                last_name: player.last_name,
                cricket_skill: player.cricket_skill || 'N/A',
                was_present_kc3: player.was_present_kc3 || 'No',
                photo_url: finalPhotoUrl,
                base_price: player.base_price || 20000000,
                category: player.category || 'Silver',
                role: player.role || 'All-rounder',
                auction_status: 'pending'
            }])
            .select();

        if (error) {
            console.error('API Push Player Error:', error);
            return NextResponse.json({
                error: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: data[0] });

    } catch (err: any) {
        console.error('API Push Player Catch:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
