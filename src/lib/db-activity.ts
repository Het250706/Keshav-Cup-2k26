import { supabase } from './supabase';

// Types
type Bid = {
    id: string;
    team_id: string;
    player_id: string;
    amount: number;
    created_at: string;
    players?: {
        id: string;
        name: string;
    } | null;
};

type Player = {
    id: string;
    name: string;
    sold_price: number | null;
    team_id: string;
    is_sold: boolean;
};

type AuctionStats = {
    soldCount: number;
    mostBids: any;
};


// Get full activity of a team
export async function getTeamFullActivity(teamId: string): Promise<{
    bids: Bid[];
    squad: Player[];
    totalSpent: number;
}> {
    try {
        // Fetch bids
        const { data: bids, error: bidsError } = await supabase
            .from('bids')
            .select(`
                id,
                team_id,
                player_id,
                amount,
                created_at,
                players (
                    id,
                    name
                )
            `)
            .eq('team_id', teamId)
            .order('created_at', { ascending: false });

        if (bidsError) {
            console.error('Error fetching bids:', bidsError.message);
            return { bids: [], squad: [], totalSpent: 0 };
        }

        // Fetch squad (players bought by team)
        const { data: squad, error: squadError } = await supabase
            .from('players')
            .select(`
                id,
                name,
                sold_price,
                team_id,
                is_sold
            `)
            .eq('team_id', teamId)
            .eq('is_sold', true);

        if (squadError) {
            console.error('Error fetching squad:', squadError.message);
            return {
                bids: (bids as any) || [],
                squad: [],
                totalSpent: 0
            };
        }

        // Calculate total spent
        const totalSpent = (squad || []).reduce(
            (sum: number, player: any) => sum + Number(player.sold_price || 0),
            0
        );

        return {
            bids: (bids as any) || [],
            squad: (squad as any) || [],
            totalSpent
        };

    } catch (error) {
        console.error('Unexpected error:', error);
        return { bids: [], squad: [], totalSpent: 0 };
    }
}



// Get auction statistics
export async function getAuctionStats(): Promise<AuctionStats> {
    try {
        // Get total sold players count
        const { count, error } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .eq('is_sold', true);

        if (error) {
            console.error('Error fetching sold count:', error.message);
        }

        // Get most bidded player (RPC function)
        const { data: mostBids, error: rpcError } = await supabase
            .rpc('get_most_bidded_player');

        if (rpcError) {
            console.error('Error fetching most bidded player:', rpcError.message);
        }

        return {
            soldCount: count || 0,
            mostBids: mostBids || null
        };

    } catch (error) {
        console.error('Unexpected error:', error);
        return {
            soldCount: 0,
            mostBids: null
        };
    }
}
