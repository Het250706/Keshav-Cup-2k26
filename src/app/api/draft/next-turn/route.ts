import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST() {
    try {
        const { data: state, error: stateError } = await supabaseAdmin
            .from('draft_state')
            .select('*')
            .single();

        if (stateError || !state) {
            return NextResponse.json({ error: 'No draft state found' }, { status: 404 });
        }

        const { data: order, error: orderError } = await supabaseAdmin
            .from('draft_order')
            .select('*')
            .order('position', { ascending: true });

        if (orderError || !order || order.length === 0) {
            return NextResponse.json({ error: 'Draft order not configured. Please set team order in admin panel.' }, { status: 400 });
        }

        // Cycle through the teams list based on position index
        const nextTurnIdx = (state.current_turn + 1) % order.length;
        const nextTeam = order[nextTurnIdx];

        const { error: updateError } = await supabaseAdmin
            .from('draft_state')
            .update({
                current_turn: nextTurnIdx,
                current_team_id: nextTeam.team_id,
                is_reveal_open: false,
                last_update: new Date().toISOString()
            })
            .eq('id', state.id);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update turn state' }, { status: 500 });
        }

        return NextResponse.json({ success: true, nextTeamId: nextTeam.team_id, currentTurn: nextTurnIdx });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
