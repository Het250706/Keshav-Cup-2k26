'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, MapPin, User, Trophy, ArrowUpRight, History, CreditCard, AlertCircle, Zap, Volume2, Users, Calendar, Navigation, Activity } from 'lucide-react';

const playBidSound = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
        oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        // Audio might be blocked by browser policy until user interacts
    }
};

interface Player {
    id: string;
    first_name: string;
    last_name: string;
    age: number;
    role: string;
    category: string;
    base_price: number;
    city: string;
    image_url: string;
    photo_url: string;
    batting_style: string;
    bowling_style: string;
    auction_status: string;
    status: string;
    is_sold: boolean;
}

interface AuctionState {
    status: string;
    current_player_id: string | null;
    current_highest_bid: number;
    last_bid_team_id: string | null;
    timer_remaining: number;
    bid_increment: number;
}

export default function AuctionRoom({
    teamId,
    isAdmin = false,
}: {
    teamId?: string;
    isAdmin?: boolean;
}) {

    const [player, setPlayer] = useState<Player | null>(null);
    const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
    const currentPlayerIdRef = useRef<string | null>(null);
    const [isBidding, setIsBidding] = useState(false);
    const [bidHistory, setBidHistory] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [onlineCaptains, setOnlineCaptains] = useState(0);
    const [lastBidder, setLastBidder] = useState<string | null>(null);
    const [showBidFlash, setShowBidFlash] = useState(false);
    const [connected, setConnected] = useState(false);
    const channelRef = useRef<any>(null);

    useEffect(() => {
        fetchInitialState();

        const channel = supabase
            .channel('auction_arena_realtime', {
                config: {
                    presence: {
                        key: teamId || 'viewer',
                    },
                },
            });

        channelRef.current = channel;

        channel
            // ZERO-LAG BROADCAST LISTENER (Socket.io Style)
            .on('broadcast', { event: 'bid' }, (payload: any) => {
                const { amount, team_id } = payload.payload;

                // Instantly update UI for other clients
                setAuctionState(prev => prev ? {
                    ...prev,
                    current_highest_bid: amount,
                    last_bid_team_id: team_id
                } : null);

                setLastBidder(team_id);
                setShowBidFlash(true);
                playBidSound();
                setTimeout(() => setShowBidFlash(false), 500);
            })
            .on(
                'postgres_changes' as any,
                { event: 'UPDATE', schema: 'public', table: 'auction_state', filter: 'id=eq.1' },
                (payload: any) => {
                    setAuctionState(payload.new as AuctionState);
                }
            )
            .on(
                'postgres_changes' as any,
                { event: 'UPDATE', schema: 'public', table: 'players' },
                (payload: any) => {
                    setPlayer(prev => {
                        if (prev && prev.id === payload.new.id) {
                            return { ...prev, ...payload.new };
                        }
                        return prev;
                    });
                }
            )
            .on(
                'postgres_changes' as any,
                { event: 'INSERT', schema: 'public', table: 'bids' },
                (payload: any) => {
                    // Sync bid history from DB for consistency
                    if (currentPlayerIdRef.current) {
                        fetchBidHistory(currentPlayerIdRef.current);
                    }
                }
            )
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                setOnlineCaptains(Object.keys(state).length);
            })
            .subscribe(async (status: any) => {
                if (status === 'SUBSCRIBED') {
                    setConnected(true);
                    await channel.track({ online_at: new Date().toISOString() });
                } else {
                    setConnected(false);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [teamId]);

    useEffect(() => {
        if (auctionState?.current_player_id) {
            currentPlayerIdRef.current = auctionState.current_player_id;
            fetchPlayer(auctionState.current_player_id);
            fetchBidHistory(auctionState.current_player_id);
        } else {
            currentPlayerIdRef.current = null;
            setPlayer(null);
            setBidHistory([]);
        }
    }, [auctionState?.current_player_id]);


    const fetchInitialState = async () => {
        const { data } = await supabase
            .from('auction_state')
            .select('*')
            .eq('id', 1)
            .single();

        if (data) {
            setAuctionState(data);
            currentPlayerIdRef.current = data.current_player_id;
        }
    };

    const fetchPlayer = async (id: string) => {
        const { data } = await supabase
            .from('players')
            .select('*')
            .eq('id', id)
            .single();

        if (data) setPlayer(data);
    };

    const fetchBidHistory = async (playerId: string) => {
        const { data } = await supabase
            .from('bids')
            .select(`
                *,
                teams (name)
            `)
            .eq('player_id', playerId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (data) setBidHistory(data);
    };

    const placeSpecificBid = async (increment: number) => {
        if (!auctionState || !player || !teamId || isBidding) return;
        setError(null);

        const newBid = (auctionState.current_highest_bid || player.base_price) + (auctionState.current_highest_bid === 0 ? 0 : increment);
        const previousState = { ...auctionState };

        // 1. BROADCAST INSTANTLY (Socket.io Emit)
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'bid',
                payload: { amount: newBid, team_id: teamId }
            });
        }

        // 2. Optimistic UI update
        setAuctionState(prev => prev ? {
            ...prev,
            current_highest_bid: newBid,
            last_bid_team_id: teamId
        } : null);

        playBidSound();
        setIsBidding(true);

        try {
            const res = await fetch('/api/bids/place', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    team_id: teamId,
                    player_id: player.id,
                    amount: newBid
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setAuctionState(previousState);
                setError(data.error || 'Bid rejected by system');
            }
        } catch (err) {
            setAuctionState(previousState);
            setError('Connection error. Please retry.');
        } finally {
            setIsBidding(false);
        }
    };

    if (!auctionState || auctionState.status === 'idle') {
        return (
            <div style={{ padding: '80px', textAlign: 'center', background: 'rgba(255, 215, 0, 0.02)', borderRadius: '30px', border: '1px dashed rgba(255, 215, 0, 0.2)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#00ff80' : '#ff4b4b' }} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>{connected ? 'LIVE WEBSOCKET ACTIVE' : 'RECONNECTING...'}</span>
                </div>
                <Trophy size={64} color="var(--primary)" style={{ marginBottom: '25px', opacity: 0.8 }} />
                <h3 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '2px', color: 'var(--primary)' }}>KESHAV CUP 2026</h3>
                <p style={{ color: 'var(--text-muted)', marginTop: '15px', fontSize: '1.1rem', fontWeight: 600 }}>Waiting for the auctioneer to bring the next player to the floor.</p>
                <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                    <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                        <Users size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> {onlineCaptains} CAPTAINS ONLINE
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <div className="auction-grid">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <AnimatePresence mode="wait">
                            {player && (
                                <motion.div
                                    key={player.id}
                                    className="player-card"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.02 }}
                                    transition={{ duration: 0.4 }}
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
                                        borderRadius: '24px',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        border: showBidFlash ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        boxShadow: showBidFlash ? '0 0 40px var(--primary-glow)' : '0 20px 40px rgba(0,0,0,0.4)',
                                        transition: 'all 0.2s ease-out'
                                    }}
                                >
                                    <div className="player-image" style={{ width: '320px', height: '400px', flexShrink: 0, overflow: 'hidden', background: '#111', position: 'relative' }}>
                                        <img
                                            src={player.image_url || player.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.first_name}`}
                                            alt={`${player.first_name} ${player.last_name}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                        <div style={{ position: 'absolute', top: '15px', left: '15px' }}>
                                            <span className={`badge-${player.category?.toLowerCase()}`} style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 800 }}>
                                                {player.category}
                                            </span>
                                        </div>
                                        {auctionState.status === 'unsold' && (
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 75, 75, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'grayscale(1) blur(2px)' }}>
                                                <div style={{ background: '#ff4b4b', color: '#fff', padding: '8px 24px', borderRadius: '10px', fontWeight: 900, fontSize: '1.2rem' }}>UNSOLD</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="player-info" style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <div style={{ marginBottom: '8px', color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '2px' }}>ON FLOOR</div>
                                        <h1 className="player-name" style={{ fontSize: '3rem', fontWeight: 950, marginBottom: '15px', letterSpacing: '-1.5px', lineHeight: '1.1' }}>{player.first_name} {player.last_name}</h1>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '25px' }}>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 15px', borderRadius: '15px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Trophy size={16} color="var(--primary)" />
                                                <div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800 }}>ROLE</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 900 }}>{player.role.toUpperCase()}</div>
                                                </div>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 15px', borderRadius: '15px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Calendar size={16} color="var(--primary)" />
                                                <div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800 }}>AGE</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 900 }}>{player.age || '20'} YRS</div>
                                                </div>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 15px', borderRadius: '15px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Navigation size={16} color="var(--primary)" />
                                                <div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800 }}>BASE</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 900 }}>{player.city?.toUpperCase() || 'LOCAL'}</div>
                                                </div>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 15px', borderRadius: '15px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Activity size={16} color="var(--primary)" />
                                                <div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800 }}>BATTING</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 900 }}>{player.batting_style?.replace('_', ' ').toUpperCase() || 'ST'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ background: 'rgba(255, 215, 0, 0.05)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,215,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                            <div style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '2px', marginBottom: '5px' }}>CURRENT BID</div>
                                            <motion.div
                                                key={auctionState.current_highest_bid}
                                                initial={{ scale: 1.1, filter: 'brightness(2)' }}
                                                animate={{ scale: 1, filter: 'brightness(1)' }}
                                                className="bid-amount"
                                                style={{ fontSize: '3.2rem', fontWeight: 950, color: '#fff', textShadow: '0 0 20px rgba(255,215,0,0.3)', lineHeight: '1' }}
                                            >
                                                ₹ {((auctionState.current_highest_bid || player.base_price) / 10000000).toFixed(2)} Cr
                                            </motion.div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {!isAdmin && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <button
                                        onClick={() => placeSpecificBid(auctionState.bid_increment)}
                                        disabled={isBidding || auctionState.status !== 'active'}
                                        className="btn-primary"
                                        style={{ height: '70px', fontSize: '1.1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                    >
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.8 }}>+ {auctionState.bid_increment / 100000} L</div>
                                        <div style={{ fontWeight: 900 }}>PLACE BID</div>
                                    </button>

                                    <button
                                        onClick={() => placeSpecificBid(10000000)}
                                        disabled={isBidding || auctionState.status !== 'active'}
                                        className="btn-secondary"
                                        style={{ height: '70px', fontSize: '1.1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '1px solid #ffaa00', color: '#ffaa00' }}
                                    >
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.8 }}>+ 1.00 Cr</div>
                                        <div style={{ fontWeight: 900 }}>MEGA BID</div>
                                    </button>
                                </div>
                            </div>
                        )}
                        {error && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ color: '#ff4b4b', background: 'rgba(255, 75, 75, 0.1)', padding: '10px 15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                                <AlertCircle size={14} /> {error}
                            </motion.div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ padding: '20px', borderRadius: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>AUCTION STATUS</div>
                            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: auctionState.status === 'active' ? '#00ff80' : 'var(--primary)', letterSpacing: '1px' }}>
                                {auctionState.status.toUpperCase()}
                            </div>
                        </div>

                        <div className="glass" style={{ flex: 1, padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '15px', fontSize: '0.75rem', fontWeight: 800 }}>
                                <History size={14} /> LIVE BIDS
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '300px' }}>
                                {bidHistory.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>No bids yet...</div>
                                ) : (
                                    bidHistory.map((bid: any, i: number) => (
                                        <motion.div initial={{ x: 10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} key={bid.id} style={{ padding: '10px', background: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: i === 0 ? '3px solid var(--primary)' : '1px solid transparent' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{bid.teams?.name || 'Franchise'}</div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: i === 0 ? 'var(--primary)' : '#fff' }}>₹ {(bid.amount / 10000000).toFixed(2)} Cr</div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style jsx>{`
                .auction-grid {
                    display: grid;
                    grid-template-columns: 1fr 340px;
                    gap: 30px;
                }
                @media (max-width: 1100px) {
                    .auction-grid {
                        grid-template-columns: 1fr;
                    }
                }
                @media (max-width: 768px) {
                    .player-card {
                        flex-direction: column !important;
                    }
                    .player-image {
                        width: 100% !important;
                        height: 300px !important;
                    }
                    .player-info {
                        padding: 25px !important;
                    }
                    .player-name {
                        font-size: 2.2rem !important;
                    }
                    .bid-amount {
                        font-size: 2.8rem !important;
                    }
                }
            `}</style>
        </>
    );
}
