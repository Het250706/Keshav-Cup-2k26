import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('id');

        if (!playerId) {
            return NextResponse.json({ success: false, error: 'Player ID is required' }, { status: 400 });
        }

        // STEP 1: Fetch player info, clear active auction state, and delete bids in parallel
        const [playerRes] = await Promise.all([
            supabaseAdmin.from('players').select('*').eq('id', playerId).single(),
            supabaseAdmin.from('auction_state').update({ current_player_id: null, status: 'IDLE' }).eq('current_player_id', playerId),
            supabaseAdmin.from('bids').delete().eq('player_id', playerId)
        ]);

        const player = playerRes.data;

        // STEP 2: Concurrently delete player from pool, restore to registrations (is_pushed = false), and refund team budget!
        const postDeleteTasks: Promise<any>[] = [
            supabaseAdmin.from('players').delete().eq('id', playerId)
        ];

        if (player) {
            const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim();

            // Task: Return player to REGISTRATION CONTROL by setting is_pushed = false (or insert if not exists)
            const restoreTask = (async () => {
                try {
                    // 1. Direct update to registrations by name (handles single or duplicate names safely)
                    const { data: updatedRegs } = await supabaseAdmin
                        .from('registrations')
                        .update({ is_pushed: false })
                        .ilike('name', fullName)
                        .select('id');

                    let didUpdate = updatedRegs && updatedRegs.length > 0;

                    // 2. If not found by full name, try matching first and last name pattern
                    if (!didUpdate && player.first_name && player.last_name) {
                        const { data: fuzzyRegs } = await supabaseAdmin
                            .from('registrations')
                            .update({ is_pushed: false })
                            .ilike('name', `%${player.first_name}%${player.last_name}%`)
                            .select('id');

                        didUpdate = fuzzyRegs && fuzzyRegs.length > 0;
                    }

                    // 3. If no matching registration exists, create a new one!
                    if (!didUpdate) {
                        let restorePhoto = player.photo_url || '';
                        if (restorePhoto.includes('drive.google.com')) {
                            const fileIdMatch = restorePhoto.match(/[-\w]{25,}/);
                            if (fileIdMatch) {
                                restorePhoto = `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}`;
                            }
                        }

                        await supabaseAdmin
                            .from('registrations')
                            .insert([{
                                name: fullName,
                                role: player.cricket_skill || player.role || 'All-rounder',
                                base_price: player.base_price || 100,
                                mobile: player.category && player.category !== 'Unassigned' ? player.category : '',
                                age: Number(player.batting_style) || 20,
                                city: player.was_present_kc3 || 'No',
                                photo: restorePhoto,
                                is_pushed: false
                            }]);
                        console.log(`Created new record in REGISTRATION CONTROL for "${fullName}" (is_pushed = false)`);
                    } else {
                        console.log(`Successfully returned "${fullName}" to REGISTRATION CONTROL (is_pushed = false)`);
                    }
                } catch (e) {
                    console.error('Registration restore error:', e);
                }
            })();
            postDeleteTasks.push(restoreTask);

            // Task: Refund budget to team if the player was sold
            if (player.auction_status === 'sold' && player.team_id && player.sold_price) {
                const refundTask = (async () => {
                    try {
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
                            console.log(`Refunded ${soldPrice} Pushp to team ${player.team_id}`);
                        }
                    } catch (e) {
                        console.error('Refund budget error:', e);
                    }
                })();
                postDeleteTasks.push(refundTask);
            }
        }

        // Run all critical database tasks concurrently
        await Promise.all(postDeleteTasks);

        return NextResponse.json({
            success: true,
            message: 'Player removed from pool and returned to Registration Control'
        });

    } catch (error: any) {
        console.error('Delete Player Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
