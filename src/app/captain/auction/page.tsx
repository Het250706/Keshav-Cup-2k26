'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import RoleGuard from '@/components/RoleGuard';
import { useAuth } from '@/components/AuthProvider';
import { fixPhotoUrl } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Gavel,
    AlertCircle,
    Loader2,
    Zap,
} from 'lucide-react';
import { BIDDING_STAGES, getPurplePushp, getNextBid, MAX_SQUAD_SIZE } from '@/lib/auction-logic';

export default function CaptainAuctionPage() {
    return (
        <RoleGuard allowedRole="captain">
            <CaptainAuctionContent />
        </RoleGuard>
    );
}

function CaptainAuctionContent() {
    const { user } = useAuth();
    const [myTeam, setMyTeam] = useState<any>(null);
    const [mySquadCount, setMySquadCount] = useState(0);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [currentPlayer, setCurrentPlayer] = useState<any>(null);
    const [highestBidTeam, setHighestBidTeam] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [bidLoading, setBidLoading] = useState(false);
    const [cooldown, setCooldown] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const bidButtonRef = useRef<HTMLButtonElement>(null);

    const fetchData = async (onlyState = false) => {
        if (!user?.email) return;

        try {
            // Get My Team
            const { data: teamData } = await supabase
                .from('teams')
                .select('*')
                .eq('captain_email', user.email)
                .single();
            if (teamData) {
                setMyTeam(teamData);
                // Also get squad count
                const { count } = await supabase
                    .from('players')
                    .select('*', { count: 'exact', head: true })
                    .eq('team_id', teamData.id)
                    .eq('auction_status', 'sold');
                setMySquadCount(count || 0);
            }

            // Get State
            const { data: stateData } = await supabase
                .from('auction_state')
                .select('*')
                .single();

            if (stateData) {
                setAuctionState(stateData);

                // Get Current Player if active
                if (stateData.current_player_id && (!currentPlayer || currentPlayer.id !== stateData.current_player_id)) {
                    const { data: playerData } = await supabase
                        .from('players')
                        .select('*')
                        .eq('id', stateData.current_player_id)
                        .single();
                    setCurrentPlayer(playerData);

                    // Auto-focus logic when a new player appears
                    setTimeout(() => {
                        bidButtonRef.current?.focus();
                    }, 500);
                } else if (!stateData.current_player_id) {
                    setCurrentPlayer(null);
                }

                // Get Highest Bid Team
                if (stateData.highest_bid_team_id) {
                    const { data: teamBidData } = await supabase
                        .from('teams')
                        .select('name')
                        .eq('id', stateData.highest_bid_team_id)
                        .single();
                    setHighestBidTeam(teamBidData);
                } else {
                    setHighestBidTeam(null);
                }
            }
        } catch (err) {
            console.error('Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const stateSub = supabase.channel('captain_auction_realtime')
            .on('postgres_changes', { event: '*', table: 'auction_state', schema: 'public' }, () => fetchData(true))
            .on('postgres_changes', { event: '*', table: 'teams', schema: 'public' }, (p) => {
                if (p.new && (p.new as any).captain_email === user?.email) fetchData();
            })
            .on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
    }, [user?.email]);

    // Keyboard support: ENTER key to bid
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleBid();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [myTeam, auctionState, bidLoading, cooldown, mySquadCount]);

    const handleBid = async () => {
        if (!myTeam || bidLoading || cooldown || auctionState?.status !== 'BIDDING') return;

        // Final validation
        const nextBid = getNextBid(auctionState.current_highest_bid || 0);
        if (mySquadCount >= MAX_SQUAD_SIZE || myTeam.remaining_budget < nextBid) return;

        setBidLoading(true);
        setCooldown(true);
        setError(null);

        try {
            const res = await fetch('/api/auction/v3/bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_id: myTeam.id })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Bid failed');
        } catch (err: any) {
            setError(err.message);
            setTimeout(() => setError(null), 3000);
        } finally {
            setBidLoading(false);
            // 1 second cooldown to prevent spam
            setTimeout(() => setCooldown(false), 1000);
        }
    };

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
            <Loader2 className="animate-spin" size={48} color="var(--primary)" />
        </div>
    );

    const formatPushp = (amount: number) => {
        const purple = getPurplePushp(amount);
        return `${amount.toLocaleString()} Pushp${purple ? ` (${purple} Purple Pushp)` : ''}`;
    };

    return (
        <main style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', paddingBottom: '220px' }}>
            <Navbar />

            <div className="container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>

                {/* Team Info Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 30px',
                    background: 'rgba(255,215,0,0.05)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,215,0,0.1)',
                    marginBottom: '30px'
                }}>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '2px' }}>TEAM PORTAL</div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 900 }}>{myTeam?.name || 'CAPTAIN DASHBOARD'}</h1>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Squad: {mySquadCount} / {MAX_SQUAD_SIZE}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>REMAINING PURSE</div>
                        <motion.div
                            key={myTeam?.remaining_budget}
                            initial={{ scale: 1.1, color: '#fff' }}
                            animate={{ scale: 1, color: 'var(--primary)' }}
                            style={{ fontSize: '2rem', fontWeight: 950 }}
                        >
                            {myTeam?.remaining_budget || 0} P
                        </motion.div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {auctionState?.status === 'BIDDING' && currentPlayer ? (
                        <motion.div
                            key={currentPlayer.id}
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.05, y: -20 }}
                        >
                            {/* Player Card */}
                            <div className="glass" style={{ padding: '30px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '30px' }}>
                                <div style={{ display: 'flex', gap: '40px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ width: '220px', height: '260px', borderRadius: '25px', overflow: 'hidden', border: '3px solid var(--primary)', background: '#111', boxShadow: '0 0 30px rgba(255,215,0,0.1)' }}>
                                        <img
                                            src={fixPhotoUrl(currentPlayer.photo_url)}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            alt=""
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPlayer.first_name}`;
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h2 style={{ fontSize: '3rem', fontWeight: 950, lineHeight: 1, marginBottom: '15px', color: '#fff' }}>
                                            {currentPlayer.first_name} {currentPlayer.last_name}
                                        </h2>
                                        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
                                            <div style={{ padding: '8px 20px', borderRadius: '12px', background: 'rgba(255,215,0,0.1)', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 900, border: '1px solid rgba(255,215,0,0.2)' }}>
                                                {currentPlayer.cricket_skill}
                                            </div>
                                            <div style={{ padding: '8px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', fontSize: '0.9rem', fontWeight: 800 }}>
                                                Last KC Participation: {currentPlayer.was_present_kc3}
                                            </div>
                                        </div>

                                        <div style={{ background: 'rgba(0,0,0,0.4)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '1px' }}>CURRENT BID</div>
                                                <motion.div
                                                    key={auctionState.current_highest_bid}
                                                    initial={{ scale: 1.1 }}
                                                    animate={{ scale: 1 }}
                                                    style={{ fontSize: '3rem', fontWeight: 950, color: '#fff' }}
                                                >
                                                    {formatPushp(auctionState.current_highest_bid || 0)}
                                                </motion.div>
                                            </div>
                                            {highestBidTeam && (
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>HIGHEST BIDDER</div>
                                                    <div style={{ fontSize: '1.6rem', fontWeight: 950, color: 'var(--primary)' }}>{highestBidTeam.name}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div style={{ padding: '100px 20px', textAlign: 'center', opacity: 0.5 }}>
                            <Gavel size={60} style={{ margin: '0 auto 20px' }} />
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>AUCTION IDLE</h2>
                            <p>Admin is preparing the next player.</p>
                        </div>
                    )}
                </AnimatePresence>

                {error && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'fixed', bottom: '220px', left: '50%', transform: 'translateX(-50%)', background: '#ff4b4b', color: '#fff', padding: '15px 40px', borderRadius: '50px', fontWeight: 900, zIndex: 2000, boxShadow: '0 10px 40px rgba(255,75,75,0.5)' }}>
                        <AlertCircle size={24} style={{ display: 'inline', marginRight: '10px' }} /> {error}
                    </motion.div>
                )}
            </div>

            {/* BIG PUSH BUTTON PANEL */}
            {auctionState?.status === 'BIDDING' && (
                <div style={{
                    position: 'fixed',
                    bottom: '0',
                    left: '0',
                    right: '0',
                    background: 'linear-gradient(to top, #000 80%, transparent)',
                    padding: '40px 20px 60px',
                    zIndex: 1000
                }}>
                    <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
                        {(() => {
                            const nextBid = getNextBid(auctionState.current_highest_bid || 0);
                            const isSquadFull = mySquadCount >= MAX_SQUAD_SIZE;
                            const isInsufficient = (myTeam?.remaining_budget || 0) < nextBid;
                            const isExhausted = (myTeam?.remaining_budget || 0) <= 0;

                            const isDisabled = isSquadFull || isInsufficient || bidLoading || cooldown;

                            let label = `PLACE NEXT BID: ${nextBid} P`;
                            if (isInsufficient) label = "INSUFFICIENT PUSHP";
                            if (isExhausted) label = "PURSE EXHAUSTED";
                            if (isSquadFull) label = "SQUAD FULL";

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <button
                                        ref={bidButtonRef}
                                        disabled={isDisabled}
                                        onClick={handleBid}
                                        style={{
                                            width: '100%',
                                            height: '100px',
                                            borderRadius: '25px',
                                            background: isDisabled ? 'rgba(255,255,255,0.05)' : 'var(--primary)',
                                            color: isDisabled ? 'rgba(255,255,255,0.3)' : '#000',
                                            fontWeight: 950,
                                            fontSize: '2.5rem',
                                            border: 'none',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            boxShadow: isDisabled ? 'none' : '0 20px 50px rgba(255,215,0,0.4)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '20px',
                                            textTransform: 'uppercase',
                                            transition: 'all 0.2s ease',
                                            outline: 'none'
                                        }}
                                        className="bid-btn"
                                    >
                                        {bidLoading ? <Loader2 className="animate-spin" size={40} /> : <><Zap size={36} fill="currentColor" /> {label}</>}
                                    </button>
                                    <div style={{ marginTop: '15px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                        PRESS <span style={{ color: '#fff' }}>ENTER</span> TO PLACE BID INSTANTLY
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            <style jsx>{`
                .bid-btn:active:not(:disabled) { transform: scale(0.96); }
                .bid-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-2px); }
                .glass { backdrop-filter: blur(20px); background: rgba(255,255,255,0.02); }
            `}</style>
        </main>
    );
}
