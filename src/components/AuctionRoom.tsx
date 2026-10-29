'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, History, Users, Gavel, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { fixPhotoUrl } from '@/lib/utils';
import { getPurplePushp, getNextBid, MAX_SQUAD_SIZE } from '@/lib/auction-logic';
import { playBidSound, playHammerSound } from '@/lib/audio';

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
    const [myTeam, setMyTeam] = useState<any>(null);
    const [highestBidTeam, setHighestBidTeam] = useState<any>(null);
    const [mySquadCount, setMySquadCount] = useState(0);
    const [isBidding, setIsBidding] = useState(false);
    const [bidToast, setBidToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const currentPlayerIdRef = useRef<string | null>(null);
    const teamIdRef = useRef<string | undefined>(teamId);

    useEffect(() => {
        teamIdRef.current = teamId;
    }, [teamId]);

    const fetchData = async () => {
        try {
            const { data: stateData } = await supabase.from('auction_state').select('*').single();
            if (stateData) {
                setAuctionState(stateData);
                currentPlayerIdRef.current = stateData.current_player_id;
                if (stateData.current_player_id) {
                    const { data: playerData } = await supabase.from('players').select('*').eq('id', stateData.current_player_id).single();
                    setPlayer(playerData);
                    fetchBidHistory(stateData.current_player_id);
                } else {
                    setPlayer(null);
                    setBidHistory([]);
                }

                if (stateData.highest_bid_team_id) {
                    const { data: hTeam } = await supabase.from('teams').select('name').eq('id', stateData.highest_bid_team_id).single();
                    setHighestBidTeam(hTeam);
                } else {
                    setHighestBidTeam(null);
                }
            }

            if (teamId) {
                const { data: teamData } = await supabase.from('teams').select('*').eq('id', teamId).single();
                setMyTeam(teamData);
                const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('team_id', teamId).eq('auction_status', 'sold');
                setMySquadCount(count || 0);
            }
        } catch (err) {
            console.error('Fetch Error in AuctionRoom:', err);
        }
    };

    const fetchBidHistory = async (playerId: string) => {
        const { data } = await supabase
            .from('bids')
            .select(`*, teams(name)`)
            .eq('player_id', playerId)
            .order('created_at', { ascending: false })
            .limit(6);
        if (data) setBidHistory(data);
    };

    useEffect(() => {
        fetchData();
        const stateSub = supabase.channel('auction_room_v4')
            .on('postgres_changes', { event: '*', table: 'auction_state', schema: 'public' }, (p: any) => {
                const newState = p.new;
                setAuctionState(newState);

                if (newState?.status === 'SOLD') {
                    playHammerSound();
                }

                if (newState?.current_player_id) {
                    currentPlayerIdRef.current = (newState as any).current_player_id;
                    fetchData();
                } else {
                    setPlayer(null);
                    setHighestBidTeam(null);
                    setBidHistory([]);
                }
            })
            .on('postgres_changes', { event: '*', table: 'teams', schema: 'public' }, (p: any) => {
                if (teamIdRef.current && (p.new as any).id === teamIdRef.current) {
                    setMyTeam(p.new);
                }
            })
            .on('postgres_changes', { event: 'INSERT', table: 'bids', schema: 'public' }, () => {
                playBidSound();
                if (currentPlayerIdRef.current) fetchBidHistory(currentPlayerIdRef.current);
            })
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
    }, [teamId]);

    const formatPushp = (amount: number) => {
        const purple = getPurplePushp(amount);
        return `${amount.toLocaleString()} Pushp${purple ? ` (${purple} Purple)` : ''}`;
    };

    // Captain place bid handler from AuctionRoom
    const handlePlaceBid = async () => {
        if (!teamId || !myTeam || isBidding || auctionState?.status !== 'BIDDING' || !player) return;

        const nextBid = getNextBid(auctionState.current_highest_bid || 0);

        if (myTeam.remaining_budget < nextBid) {
            setBidToast({ message: `Insufficient purse! Remaining: ${myTeam.remaining_budget} P, Need: ${nextBid} P`, type: 'error' });
            setTimeout(() => setBidToast(null), 3000);
            return;
        }

        if (mySquadCount >= MAX_SQUAD_SIZE) {
            setBidToast({ message: `Squad limit reached (${MAX_SQUAD_SIZE}/${MAX_SQUAD_SIZE})`, type: 'error' });
            setTimeout(() => setBidToast(null), 3000);
            return;
        }

        if (auctionState.highest_bid_team_id === myTeam.id) {
            setBidToast({ message: 'Your team is already the highest bidder!', type: 'info' });
            setTimeout(() => setBidToast(null), 2500);
            return;
        }

        setIsBidding(true);
        try {
            const res = await fetch('/api/auction/v3/bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_id: myTeam.id })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Bid placement failed');

            playBidSound();
            setBidToast({ message: `Bid of ${nextBid} Pushp placed! ✓`, type: 'success' });
            setTimeout(() => setBidToast(null), 3000);
            fetchData();
        } catch (err: any) {
            setBidToast({ message: err.message, type: 'error' });
            setTimeout(() => setBidToast(null), 3500);
        } finally {
            setTimeout(() => setIsBidding(false), 800);
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

    const nextBid = getNextBid(auctionState.current_highest_bid || 0);
    const isLeading = Boolean(auctionState.highest_bid_team_id && myTeam && auctionState.highest_bid_team_id === myTeam.id);
    const isInsufficient = Boolean(myTeam && myTeam.remaining_budget < nextBid);
    const isSquadFull = mySquadCount >= MAX_SQUAD_SIZE;
    const canBid = teamId && auctionState.status === 'BIDDING' && player && !isLeading && !isInsufficient && !isSquadFull && !isBidding;

    return (
        <div style={{ position: 'relative' }}>
            {/* INLINE TOAST ALERT */}
            <AnimatePresence>
                {bidToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{
                            position: 'absolute',
                            top: '-50px',
                            right: '20px',
                            zIndex: 100,
                            background: bidToast.type === 'error'
                                ? 'rgba(255, 50, 50, 0.95)'
                                : bidToast.type === 'info'
                                    ? 'rgba(0, 210, 255, 0.95)'
                                    : 'rgba(0, 200, 83, 0.95)',
                            color: '#fff',
                            padding: '10px 18px',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 8px 25px rgba(0,0,0,0.5)'
                        }}
                    >
                        {bidToast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                        <span>{bidToast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '30px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    <AnimatePresence mode="wait">
                        {player && (
                            <motion.div
                                key={player.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: '25px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    border: '1px solid var(--border)'
                                }}
                            >
                                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                    <div style={{ width: '260px', height: '320px', background: '#111' }}>
                                        <img
                                            src={fixPhotoUrl(player.photo_url, player.first_name)}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            alt=""
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.first_name}`;
                                            }}
                                        />
                                    </div>

                                    <div style={{ flex: 1, padding: '25px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '2px' }}>
                                            NOW ON FLOOR
                                        </div>
                                        <h1 style={{ fontSize: '2.4rem', fontWeight: 950, marginBottom: '12px', lineHeight: 1.1 }}>
                                            {player.first_name} <span style={{ color: 'var(--primary)' }}>{player.last_name}</span>
                                        </h1>

                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                            <div style={{ padding: '6px 14px', background: 'rgba(255,215,0,0.1)', color: 'var(--primary)', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800 }}>
                                                {player.cricket_skill}
                                            </div>
                                            <div style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800 }}>
                                                KC3: {player.was_present_kc3}
                                            </div>
                                            <div style={{ padding: '6px 14px', background: 'rgba(255,215,0,0.1)', color: 'var(--primary)', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800 }}>
                                                BASE: {player.base_price} P
                                            </div>
                                        </div>

                                        <div style={{
                                            background: 'rgba(0,0,0,0.5)',
                                            padding: '18px 22px',
                                            borderRadius: '16px',
                                            border: '1px solid rgba(255,215,0,0.2)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800 }}>
                                                    CURRENT BID
                                                </div>
                                                <div style={{ fontSize: '2.4rem', fontWeight: 950 }}>
                                                    {formatPushp(auctionState.current_highest_bid || 0)}
                                                </div>
                                            </div>
                                            {highestBidTeam && (
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                                                        HIGHEST BIDDER
                                                    </div>
                                                    <div style={{ fontSize: '1.3rem', fontWeight: 950, color: isLeading ? '#00ff80' : 'var(--primary)' }}>
                                                        {isLeading ? '👑 YOU ARE LEADING' : highestBidTeam.name}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* === CAPTAIN BID BUTTON SECTION === */}
                                {teamId && auctionState.status === 'BIDDING' && (
                                    <div style={{
                                        padding: '20px 25px',
                                        background: 'linear-gradient(to right, rgba(255,215,0,0.05), rgba(0,0,0,0.4))',
                                        borderTop: '1px solid rgba(255,255,255,0.06)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '20px',
                                        flexWrap: 'wrap'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                                                NEXT STAGE BID
                                            </div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 950, color: 'var(--primary)' }}>
                                                {nextBid} Pushp
                                            </div>
                                        </div>

                                        <motion.button
                                            whileHover={canBid ? { scale: 1.02 } : {}}
                                            whileTap={canBid ? { scale: 0.98 } : {}}
                                            onClick={handlePlaceBid}
                                            disabled={!canBid}
                                            style={{
                                                flex: 1,
                                                maxWidth: '400px',
                                                padding: '16px 24px',
                                                borderRadius: '16px',
                                                background: isLeading
                                                    ? 'rgba(0, 255, 128, 0.2)'
                                                    : !canBid
                                                        ? 'rgba(255, 255, 255, 0.05)'
                                                        : 'linear-gradient(135deg, #ffd700, #ff9900)',
                                                color: isLeading
                                                    ? '#00ff80'
                                                    : !canBid
                                                        ? 'rgba(255, 255, 255, 0.3)'
                                                        : '#000',
                                                border: isLeading
                                                    ? '1px solid rgba(0, 255, 128, 0.4)'
                                                    : !canBid
                                                        ? '1px solid rgba(255, 255, 255, 0.1)'
                                                        : 'none',
                                                fontSize: '1.1rem',
                                                fontWeight: 950,
                                                cursor: canBid ? 'pointer' : 'not-allowed',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px',
                                                boxShadow: canBid
                                                    ? '0 8px 25px rgba(255, 165, 0, 0.3)'
                                                    : 'none'
                                            }}
                                        >
                                            {isBidding ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={20} />
                                                    <span>PLACING BID...</span>
                                                </>
                                            ) : isLeading ? (
                                                <span>✓ YOUR BID IS LEADING</span>
                                            ) : isSquadFull ? (
                                                <span>SQUAD FULL ({MAX_SQUAD_SIZE}/{MAX_SQUAD_SIZE})</span>
                                            ) : isInsufficient ? (
                                                <span>INSUFFICIENT PURSE ({myTeam?.remaining_budget} P)</span>
                                            ) : (
                                                <>
                                                    <Gavel size={22} />
                                                    <span>PLACE BID — {nextBid} PUSHP</span>
                                                </>
                                            )}
                                        </motion.button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="glass" style={{ padding: '20px', borderRadius: '20px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <History size={16} color="var(--primary)" /> LIVE BIDS FEED
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {bidHistory.length > 0 ? bidHistory.map((b, i) => (
                                <div
                                    key={b.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px 14px',
                                        background: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.02)',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                        border: i === 0 ? '1px solid rgba(255,215,0,0.2)' : '1px solid transparent'
                                    }}
                                >
                                    <span style={{ fontWeight: 800 }}>{b.teams?.name || 'Unknown'}</span>
                                    <span style={{ fontWeight: 950, color: i === 0 ? 'var(--primary)' : '#fff' }}>{b.amount} P</span>
                                </div>
                            )) : (
                                <div style={{ textAlign: 'center', padding: '25px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    No bids yet
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
