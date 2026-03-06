import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('id');

        if (!playerId) {
            return NextResponse.json({ success: false, error: 'Player ID is required' }, { status: 400 });
        }

        // 1. Handle relations: Clear from auction_state if active
        await supabaseAdmin
            .from('auction_state')
            .update({ current_player_id: null, status: 'idle' })
            .eq('current_player_id', playerId);

        // 2. Delete related bids first (Foreign Key constraint)
        await supabaseAdmin
            .from('bids')
            .delete()
            .eq('player_id', playerId);

        // 3. Get player info for photo cleanup
        const { data: player } = await supabaseAdmin
            .from('players')
            .select('photo_url')
            .eq('id', playerId)
            .single();

        // 4. Delete from database
        const { error: dbError } = await supabaseAdmin
            .from('players')
            .delete()
            .eq('id', playerId);

        if (dbError) throw dbError;

        // 5. Optional: Delete photo from storage if it exists
        if (player?.photo_url) {
            try {
                const fileName = player.photo_url.split('/').pop();
                if (fileName) {
                    await supabaseAdmin.storage
                        .from('players')
                        .remove([fileName]);
                }
            } catch (storageErr) {
                console.error('Failed to delete player photo:', storageErr);
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Delete Player Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
