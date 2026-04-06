import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { slotNumber } = await request.json();

        if (slotNumber === undefined) {
             return NextResponse.json({ success: false, error: 'Missing slotNumber' }, { status: 400 });
        }

        const { data: order, error: orderError } = await supabaseAdmin
            .from('draft_order')
            .select('*')
            .order('position', { ascending: true });

        if (!order || order.length === 0) {
            return NextResponse.json({ success: false, error: 'Draft order not set. Configure team picking sequence first.' }, { status: 400 });
        }

        const firstTeam_id = order[0].team_id;

        const { data: state, error: stateError } = await supabaseAdmin
            .from('draft_state')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (state) {
            await supabaseAdmin
                .from('draft_state')
                .update({
                    current_slot: slotNumber,
                    current_turn: 0,
                    current_team_id: firstTeam_id,
                    is_reveal_open: false,
                    last_update: new Date().toISOString()
                })
                .eq('id', state.id);
        } else {
            await supabaseAdmin
                .from('draft_state')
                .insert({
                    current_slot: slotNumber,
                    current_turn: 0,
                    current_team_id: firstTeam_id,
                    is_reveal_open: false
                });
        }

        return NextResponse.json({ success: true, slotNumber });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
