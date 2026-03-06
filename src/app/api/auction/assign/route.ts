import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function POST(request: Request) {
    try {
        const { player_id, team_id, price } = await request.json();

        if (!player_id || !team_id) {
            return NextResponse.json({ error: 'Player ID and Team ID are required' }, { status: 400 });
        }

        // 1. Update player status to sold
        const { error: playerError } = await supabaseAdmin
            .from('players')
            .update({
                status: 'sold',
                auction_status: 'sold',
                team_id: team_id,
                sold_price: price
            })
            .eq('id', player_id);

        if (playerError) throw playerError;

        // 2. Deduct price from team budget
        const { data: team, error: teamFetchError } = await supabaseAdmin
            .from('teams')
            .select('remaining_budget')
            .eq('id', team_id)
            .single();

        if (teamFetchError) throw teamFetchError;

        const newBudget = team.remaining_budget - price;
        const { error: teamUpdateError } = await supabaseAdmin
            .from('teams')
            .update({ remaining_budget: newBudget })
            .eq('id', team_id);

        if (teamUpdateError) throw teamUpdateError;

        // 3. Reset auction state
        await supabaseAdmin
            .from('auction_state')
            .update({
                status: 'idle',
                current_player_id: null,
                current_highest_bid: 0,
                last_bid_team_id: null,
                timer_remaining: 0
            })
            .eq('id', 1);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
