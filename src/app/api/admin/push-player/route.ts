import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { player } = body;

        if (!player || !player.id) {
            return NextResponse.json({ error: 'No player data provided' }, { status: 400 });
        }

        // Split name into first and last name
        const nameParts = player.name?.split(' ') || ['Unknown', 'Player'];
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || 'Player';

        // Fix photo URL if it's a Google Drive link
        let finalPhoto = player.photo || player.photo_url || '';
        if (finalPhoto.includes('drive.google.com')) {
            const fileIdMatch = finalPhoto.match(/[-\w]{25,}/);
            if (fileIdMatch) {
                finalPhoto = `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}`;
            }
        }

        // 1. Insert into "players" table
        const { data: insertedData, error: insertError } = await supabaseAdmin
            .from('players')
            .insert([{
                first_name: firstName,
                last_name: lastName,
                cricket_skill: player.role || 'All-rounder',
                role: player.role || 'All-rounder',
                category: player.occupation || 'Unassigned', 
                batting_style: player.age?.toString() || '20',
                base_price: player.base_price || 20000000,
                photo_url: finalPhoto,
                auction_status: 'pending',
                was_present_kc3: player.city || player.was_present_kc3 || 'No'
            }])
            .select();

        if (insertError) {
            console.error('Push to Player Pool Error:', insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // 2. Mark as pushed in "registrations" table instead of deleting
        const { error: updateError } = await supabaseAdmin
            .from('registrations')
            .update({ is_pushed: true })
            .eq('id', player.id);

        if (updateError) {
            console.warn('Player pushed but failed to update status in registrations:', updateError);
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Player moved to pool successfully',
            data: insertedData[0]
        });

    } catch (err: any) {
        console.error('API Push Player Catch:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
