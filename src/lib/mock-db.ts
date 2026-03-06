'use client';

// Mock Data for Demo Mode
const INITIAL_PLAYERS = [
    { id: '1', name: 'Virat Kohli', age: 35, role: 'Batsman', category: 'Platinum', base_price: 200000000, city: 'Delhi', photo_url: 'https://p.imgci.com/db/PICTURES/CMS/316500/316523.jpg', is_sold: false, is_unsold: false, sold_price: null as number | null, team_id: null as string | null },
    { id: '2', name: 'Jasprit Bumrah', age: 30, role: 'Bowler', category: 'Platinum', base_price: 200000000, city: 'Mumbai', photo_url: 'https://p.imgci.com/db/PICTURES/CMS/316500/316584.jpg', is_sold: false, is_unsold: false, sold_price: null as number | null, team_id: null as string | null },
    { id: '3', name: 'Rashid Khan', age: 25, role: 'All-rounder', category: 'Platinum', base_price: 150000000, city: 'Kabul', photo_url: 'https://p.imgci.com/db/PICTURES/CMS/316600/316605.jpg', is_sold: false, is_unsold: false, sold_price: null as number | null, team_id: null as string | null },
];

const INITIAL_TEAMS = [
    { id: 't1', name: 'Mumbai Indians', owner_name: 'Ambani', remaining_budget: 1000000000, total_budget: 1000000000 },
    { id: 't2', name: 'RCB', owner_name: 'United Spirits', remaining_budget: 1000000000, total_budget: 1000000000 },
];

class MockDB {
    private players = [...INITIAL_PLAYERS];
    private teams = [...INITIAL_TEAMS];
    private bids: any[] = [];
    private auctionState: {
        status: string;
        current_player_id: string | null;
        timer_remaining: number;
        current_highest_bid: number;
        last_bid_team_id: string | null;
        bid_increment: number;
    } = {
            status: 'idle',
            current_player_id: null,
            timer_remaining: 30,
            current_highest_bid: 0,
            last_bid_team_id: null,
            bid_increment: 1000000
        };

    constructor() {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('auction_mock_db');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.players = parsed.players;
                this.teams = parsed.teams;
                this.bids = parsed.bids;
                this.auctionState = parsed.auctionState;
            }
        }
    }

    private save() {
        if (typeof window !== 'undefined') {
            localStorage.setItem('auction_mock_db', JSON.stringify({
                players: this.players,
                teams: this.teams,
                bids: this.bids,
                auctionState: this.auctionState
            }));
        }
    }

    async getPlayers() { return { data: this.players, error: null }; }
    async getAuctionState() { return { data: this.auctionState, error: null }; }
    async getTeams() { return { data: this.teams, error: null }; }

    async updateAuctionState(updates: any) {
        this.auctionState = { ...this.auctionState, ...updates };
        this.save();
        return { data: this.auctionState, error: null };
    }

    async placeBid(teamId: string, playerId: string, amount: number) {
        const bid = { id: Math.random().toString(), team_id: teamId, player_id: playerId, amount, created_at: new Date().toISOString() };
        this.bids.push(bid);
        this.auctionState.current_highest_bid = amount;
        this.auctionState.last_bid_team_id = teamId;
        this.auctionState.timer_remaining = 30;
        this.save();
        return { data: bid, error: null };
    }

    async sellPlayer(playerId: string, teamId: string, price: number) {
        const player = this.players.find(p => p.id === playerId);
        const team = this.teams.find(t => t.id === teamId);
        if (player && team) {
            player.is_sold = true;
            player.sold_price = price;
            player.team_id = teamId;
            team.remaining_budget -= price;
            this.auctionState.status = 'idle';
            this.auctionState.current_player_id = null;
            this.save();
        }
        return { error: null };
    }
}

export const mockDB = new MockDB();
