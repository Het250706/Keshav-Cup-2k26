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

        // 3. Get player info for photo cleanup and budget refund
        const { data: player } = await supabaseAdmin
            .from('players')
            .select('photo_url, auction_status, team_id, sold_price')
            .eq('id', playerId)
            .single();

        // 4. Refund budget if sold
        if (player && player.auction_status === 'sold' && player.team_id && player.sold_price) {
            const { data: team } = await supabaseAdmin
                .from('teams')
                .select('remaining_budget')
                .eq('id', player.team_id)
                .single();
            
            if (team) {
                const currentRemaining = Number(team.remaining_budget) || 0;
                const soldPrice = Number(player.sold_price) || 0;
                
                await supabaseAdmin
                    .from('teams')
                    .update({ remaining_budget: currentRemaining + soldPrice })
                    .eq('id', player.team_id);
                
                console.log(`Refunded ${soldPrice} to team ${player.team_id}`);
            }
        }

        // 5. Delete from database
        const { error: dbError } = await supabaseAdmin
            .from('players')
            .delete()
            .eq('id', playerId);

        if (dbError) throw dbError;

        // 6. Optional: Delete photo from storage if it exists
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
