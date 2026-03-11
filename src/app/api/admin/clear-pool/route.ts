import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function POST() {
    try {
        console.log('--- EMERGENCY CLEAR POOL INITIATED ---');

        // 1. Reset auction state to idle
        console.log('Resetting auction state...');
        await supabaseAdmin.from('auction_state')
            .update({
                current_player_id: null,
                status: 'IDLE',
                bidding_status: 'IDLE',
                current_highest_bid: 0,
                highest_bid_team_id: null,
                last_updated_at: new Date().toISOString()
            })
            .eq('id', 1);

        // 2. Delete related bids
        console.log('Deleting all bids...');
        await supabaseAdmin.from('bids').delete().not('id', 'is', null);

        // 3. Delete match assignments (match_players)
        console.log('Deleting match players...');
        await supabaseAdmin.from('match_players').delete().not('player_id', 'is', null);

        // 4. Delete player match stats
        console.log('Deleting player match stats...');
        await supabaseAdmin.from('player_match_stats').delete().not('player_id', 'is', null);

        // 5. Delete all players
        console.log('Deleting all players from pool...');
        const { error: deleteError } = await supabaseAdmin.from('players').delete().not('id', 'is', null);

        if (deleteError) throw deleteError;

        // 6. Reset all team budgets
        console.log('Resetting all team budgets...');
        const { data: teams } = await supabaseAdmin.from('teams').select('id, total_budget');
        if (teams) {
            for (const team of teams) {
                await supabaseAdmin.from('teams')
                    .update({ remaining_budget: team.total_budget })
                    .eq('id', team.id);
            }
        }

        console.log('--- POOL CLEARED SUCCESSFULLY ---');
        return NextResponse.json({ success: true, message: 'All players cleared and team budgets reset.' });

    } catch (error: any) {
        console.error('CRITICAL_CLEAR_ERROR:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            hint: 'Foreign key constraints might be blocking the delete. Ensure match_events allow null players or delete matches first.'
        }, { status: 500 });
    }
}
