'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, History, AlertCircle, Users, Activity } from 'lucide-react';
import { fixPhotoUrl } from '@/lib/utils';
import { getPurplePushp, getNextBid, MAX_SQUAD_SIZE } from '@/lib/auction-logic';

export default function AuctionRoom({
    teamId,
    isAdmin = false,
}: {
    teamId?: string;
    isAdmin?: boolean;
}) {

    const [player, setPlayer] = useState<any>(null);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [bidHistory, setBidHistory] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isBidding, setIsBidding] = useState(false);
    const [myTeam, setMyTeam] = useState<any>(null);
    const [mySquadCount, setMySquadCount] = useState(0);

    const fetchData = async () => {
        try {
            const { data: stateData } = await supabase.from('auction_state').select('*').single();
            if (stateData) {
                setAuctionState(stateData);
                if (stateData.current_player_id) {
                    const { data: playerData } = await supabase.from('players').select('*').eq('id', stateData.current_player_id).single();
                    setPlayer(playerData);
                    fetchBidHistory(stateData.current_player_id);
                } else {
                    setPlayer(null);
                    setBidHistory([]);
                }
            }

            if (teamId) {
                const { data: teamData } = await supabase.from('teams').select('*').eq('id', teamId).single();
                setMyTeam(teamData);
                const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('team_id', teamId).eq('auction_status', 'sold');
                setMySquadCount(count || 0);
            }
        } catch (err) {
            console.error('Fetch Error:', err);
        }
    };

    const fetchBidHistory = async (playerId: string) => {
        const { data } = await supabase
            .from('bids')
            .select(`*, teams(name)`)
            .eq('player_id', playerId)
            .order('created_at', { ascending: false })
            .limit(5);
        if (data) setBidHistory(data);
    };

    useEffect(() => {
        fetchData();
        const stateSub = supabase.channel('auction_room_v3')
            .on('postgres_changes', { event: '*', table: 'auction_state' }, (p: any) => {
                setAuctionState(p.new);
                if (p.new && (p.new as any).current_player_id) fetchData();
            })
            .on('postgres_changes', { event: '*', table: 'teams' }, (p: any) => {
                if (teamId && (p.new as any).id === teamId) fetchData();
            })
            .on('postgres_changes', { event: 'INSERT', table: 'bids' }, () => {
                if (auctionState?.current_player_id) fetchBidHistory(auctionState.current_player_id);
            })
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
    }, [teamId, auctionState?.current_player_id]);

    const formatPushp = (amount: number) => {
        const purple = getPurplePushp(amount);
        return `${amount.toLocaleString()} Pushp${purple ? ` (${purple} Purple)` : ''}`;
    };

    const handleBid = async () => {
        if (!teamId || isBidding || auctionState?.status !== 'BIDDING') return;

        const nextBid = getNextBid(auctionState.current_highest_bid || 0);
        if (mySquadCount >= MAX_SQUAD_SIZE || (myTeam?.remaining_budget || 0) < nextBid) return;

        setIsBidding(true);
        setError(null);

        try {
            const res = await fetch('/api/auction/v3/bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_id: teamId })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Bid failed');
        } catch (err: any) {
            setError(err.message);
            setTimeout(() => setError(null), 3000);
        } finally {
            setIsBidding(false);
        }
    };

    if (!auctionState || auctionState.status === 'IDLE') {
        return (
            <div style={{ padding: '60px', textAlign: 'center', background: 'rgba(255,215,0,0.02)', borderRadius: '30px', border: '1px dashed var(--primary)' }}>
                <Trophy size={60} style={{ opacity: 0.2, marginBottom: '20px' }} />
                <h3 style={{ fontSize: '1.8rem', fontWeight: 900 }}>AUCTION IDLE</h3>
                <p style={{ color: 'var(--text-muted)' }}>Waiting for the next player to appear...</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <AnimatePresence mode="wait">
                    {player && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '25px', display: 'flex', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <div style={{ width: '280px', height: '350px', background: '#111' }}>
                                <img src={fixPhotoUrl(player.photo_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            </div>
                            <div style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '2px' }}>NOW ON FLOOR</div>
                                <h1 style={{ fontSize: '2.5rem', fontWeight: 950, marginBottom: '15px' }}>{player.first_name} {player.last_name}</h1>

                                <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
                                    <div style={{ padding: '6px 15px', background: 'rgba(255,215,0,0.1)', color: 'var(--primary)', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800 }}>{player.cricket_skill}</div>
                                    <div style={{ padding: '6px 15px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800 }}>KC3: {player.was_present_kc3}</div>
                                </div>

                                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,215,0,0.2)' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800 }}>CURRENT BID</div>
                                    <div style={{ fontSize: '2.8rem', fontWeight: 950 }}>{formatPushp(auctionState.current_highest_bid || 0)}</div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!isAdmin && auctionState.status === 'BIDDING' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {(() => {
                            const nextBid = getNextBid(auctionState.current_highest_bid || 0);
                            const isSquadFull = mySquadCount >= MAX_SQUAD_SIZE;
                            const isInsufficient = (myTeam?.remaining_budget || 0) < nextBid;
                            const isHighest = auctionState.highest_bid_team_id === teamId;
                            const isDisabled = isSquadFull || isInsufficient || isHighest || isBidding;

                            let label = `PLACE BID (${nextBid} P)`;
                            if (isHighest) label = "YOU ARE HIGHEST";
                            if (isInsufficient) label = "INSUFFICIENT PUSHP";
                            if (isSquadFull) label = "SQUAD FULL (9/9)";

                            return (
                                <button
                                    onClick={handleBid}
                                    disabled={isDisabled}
                                    style={{
                                        width: '100%',
                                        height: '70px',
                                        borderRadius: '20px',
                                        background: isDisabled ? 'rgba(255,255,255,0.05)' : 'var(--primary)',
                                        color: isDisabled ? 'rgba(255,255,255,0.2)' : '#000',
                                        fontWeight: 950,
                                        fontSize: '1.5rem',
                                        border: 'none',
                                        cursor: isDisabled ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {isBidding ? <Activity className="animate-spin" /> : label}
                                </button>
                            );
                        })()}
                        {error && <div style={{ color: '#ff4b4b', fontSize: '0.8rem', textAlign: 'center', fontWeight: 800 }}>{error}</div>}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="glass" style={{ padding: '20px', borderRadius: '20px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '15px' }}>LIVE BIDS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {bidHistory.map((b, i) => (
                            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.02)', borderRadius: '10px', fontSize: '0.85rem' }}>
                                <span style={{ fontWeight: 800 }}>{b.teams?.name}</span>
                                <span style={{ fontWeight: 950, color: i === 0 ? 'var(--primary)' : '#fff' }}>{b.amount} P</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
