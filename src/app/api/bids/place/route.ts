import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { team_id, player_id, amount } = await request.json();

        // Use the high-performance RPC function
        const { data: result, error: rpcError } = await supabaseAdmin.rpc('place_bid_secure', {
            p_player_id: player_id,
            p_team_id: team_id,
            p_amount: amount
        });

        if (rpcError) throw rpcError;
        if (!result.success) throw new Error(result.error);

        return NextResponse.json({ success: true, ...result });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
