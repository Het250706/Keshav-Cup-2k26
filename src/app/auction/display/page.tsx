'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { fixPhotoUrl } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- STYLES & CONSTANTS ---
const COLORS = {
    bg: '#000000',
    white: '#ffffff',
    electricBlue: '#00d2ff',
    neonGreen: '#39ff14',
    steelGray: '#1c1c1c',
    cardLight: 'rgba(255, 255, 255, 0.03)',
    soldRed: '#ff3131',
    stamp: '#ff0000',
    accentGlow: 'rgba(0, 210, 255, 0.2)',
    brightYellow: '#ffff00',
};

const BROADCAST_NAME = "KESHAV CUP 4.0 PLAYER AUCTION / JAY SWAMINARAYAN";

export default function DisplayAuctionPage() {
    // --- STATE ---
    const [auctionState, setAuctionState] = useState<any>(null);
    const [currentPlayer, setCurrentPlayer] = useState<any>(null);
    const [highestBidTeam, setHighestBidTeam] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // UI Sequence States
    const [showStamp, setShowStamp] = useState(false);
    const [showSoldBanner, setShowSoldBanner] = useState(false);
    const [bidNotifications, setBidNotifications] = useState<any[]>([]);
    const [playedSoldPlayerId, setPlayedSoldPlayerId] = useState<string | null>(null);

    // --- REFS ---
    const lastBidValueRef = useRef<number>(0);
    const hammerSoundRef = useRef<HTMLAudioElement | null>(null);
    const bidSoundRef = useRef<HTMLAudioElement | null>(null);
    const isFirstLoadRef = useRef(true);

    // --- INITIALIZATION ---
    useEffect(() => {
        // Hammer sound: gavel/hammer hit
        hammerSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2143/2143-preview.mp3');
        // Bid sound: subtle notification or ping
        bidSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');

        fetchData();

        const stateSub = supabase.channel('display_realtime_v5')
            .on('postgres_changes', { event: '*', table: 'auction_state', schema: 'public' }, () => fetchData())
            .on('postgres_changes', { event: 'INSERT', table: 'bids', schema: 'public' }, (payload: any) => {
                handleNewBid(payload.new);
            })
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
    }, []);

    const fetchData = async () => {
        try {
            const { data: stateData } = await supabase.from('auction_state').select('*').single();
            if (stateData) {
                const statusChanged = stateData.status !== auctionState?.status;
                const playerChanged = stateData.current_player_id !== auctionState?.current_player_id;

                if (stateData.status === 'SOLD') {
                    // Start sequence only if we haven't played it for THIS player yet
                    if (playedSoldPlayerId !== stateData.current_player_id) {
                        setPlayedSoldPlayerId(stateData.current_player_id);
                        triggerSoldSequence(stateData);
                    }
                } else if (stateData.status === 'BIDDING') {
                    setPlayedSoldPlayerId(null);
                    setShowStamp(false);
                    setShowSoldBanner(false);
                    setAuctionState(stateData);
                    if (playerChanged) {
                        fetchPlayer(stateData.current_player_id);
                    }
                    fetchTeam(stateData.highest_bid_team_id);
                } else if (stateData.status === 'IDLE' || !stateData.current_player_id) {
                    setPlayedSoldPlayerId(null);
                    setAuctionState(stateData);
                    setCurrentPlayer(null);
                    setHighestBidTeam(null);
                    setShowStamp(false);
                    setShowSoldBanner(false);
                } else {
                    setAuctionState(stateData);
                }
                
                // Track bid increase for notification
                if (stateData.current_highest_bid > lastBidValueRef.current && stateData.status === 'BIDDING') {
                    if (!isFirstLoadRef.current) {
                        bidSoundRef.current?.play().catch(() => {});
                    }
                    lastBidValueRef.current = stateData.current_highest_bid;
                }
                isFirstLoadRef.current = false;
            }
        } catch (err) {
            console.error('Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlayer = async (id: string) => {
        if (!id) { setCurrentPlayer(null); return; }
        const { data } = await supabase.from('players').select('*').eq('id', id).single();
        setCurrentPlayer(data);
    };

    const fetchTeam = async (id: string) => {
        if (!id) { setHighestBidTeam(null); return; }
        const { data } = await supabase.from('teams').select('name').eq('id', id).single();
        setHighestBidTeam(data);
    };

    const handleNewBid = async (bid: any) => {
        // Prevent notifications for older bids or when in sold state
        const { data: teamData } = await supabase.from('teams').select('name').eq('id', bid.team_id).single();
        const notification = {
            id: Date.now(),
            message: `${teamData?.name || 'A team'} placed a bid of ${bid.amount} Pushp`,
            team: teamData?.name
        };
        
        setBidNotifications((prev: any[]) => [...prev.slice(-2), notification]);
        bidSoundRef.current?.play().catch(() => {});

        setTimeout(() => {
            setBidNotifications((prev: any[]) => prev.filter(n => n.id !== notification.id));
        }, 4000);
    };

    const triggerSoldSequence = async (finalState: any) => {
        // Ensure we have final data
        if (finalState.current_player_id) await fetchPlayer(finalState.current_player_id);
        if (finalState.highest_bid_team_id) await fetchTeam(finalState.highest_bid_team_id);
        
        setAuctionState(finalState);

        // DELAY A TINY BIT to ensure images/names are loaded if they just changed
        setTimeout(() => {
            setShowStamp(true);
            hammerSoundRef.current?.play().catch(() => {});

            setTimeout(() => {
                setShowSoldBanner(true);
                
                setTimeout(() => {
                    // Reset locally to IDLE view
                    setAuctionState((prev: any) => prev ? { ...prev, status: 'IDLE' } : null);
                    setCurrentPlayer(null);
                    setHighestBidTeam(null);
                    setShowStamp(false);
                    setShowSoldBanner(false);
                    setBidNotifications([]);
                    lastBidValueRef.current = 0;
                }, 6000); // Show result for 6 seconds
            }, 2500); // 2.5s gap between stamp and banner
        }, 100);
    };


    if (loading) return null;

    const isIdle = !auctionState || auctionState.status === 'IDLE' || !currentPlayer;

    return (
        <main style={{ 
            height: '100vh', 
            width: '100vw', 
            background: COLORS.bg, 
            color: COLORS.white, 
            overflow: 'hidden', 
            position: 'relative',
            fontFamily: '"Inter", "Outfit", sans-serif'
        }}>
            {/* TOP HEADER */}
            <div style={{ 
                position: 'fixed', 
                top: '50px', 
                left: 0, 
                right: 0, 
                zIndex: 100, 
                textAlign: 'center',
                pointerEvents: 'none'
            }}>
                <motion.h2 
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    style={{ 
                        fontSize: '5rem', 
                        fontWeight: 950, 
                        color: COLORS.white, 
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '12px',
                        textShadow: `0 0 30px ${COLORS.electricBlue}, 0 0 60px ${COLORS.electricBlue}, 0 10px 30px rgba(0,0,0,0.8)`,
                        background: 'linear-gradient(to bottom, #fff 40%, #888 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    } as any}
                >
                    KESHAV CUP 4.0 PLAYER AUCTION
                </motion.h2>
            </div>

            {/* Ambient Background Glows */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }}>
                <motion.div 
                    animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                        x: [0, 50, 0],
                        y: [0, -50, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    style={{ position: 'absolute', top: '10%', left: '5%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, #001f3f 0%, transparent 70%)', filter: 'blur(120px)', pointerEvents: 'none' }} 
                />
                <motion.div 
                    animate={{ 
                        scale: [1, 1.3, 1],
                        opacity: [0.2, 0.4, 0.2],
                        x: [0, -30, 0],
                        y: [0, 40, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    style={{ position: 'absolute', bottom: '5%', right: '5%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, #002200 0%, transparent 70%)', filter: 'blur(120px)', pointerEvents: 'none' }} 
                />
            </div>

            {/* Cinematic Overlays */}
            <div style={{ position: 'fixed', inset: 0, boxShadow: 'inset 0 0 400px rgba(0,0,0,0.9)', zIndex: 5, pointerEvents: 'none' }} />
            <div className="noise-overlay" style={{ position: 'fixed', inset: 0, zIndex: 6, opacity: 0.02, pointerEvents: 'none', background: 'url(https://grainy-gradients.vercel.app/noise.svg)' }} />

            {/* MAIN CONTENT AREA */}
            <div style={{ height: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative' }}>
                <AnimatePresence mode="wait">
                    {!isIdle && currentPlayer && (
                        <motion.div 
                            key={currentPlayer.id}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.05, filter: 'blur(30px)' }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '95%', maxWidth: '1920px' }}
                        >
                            <div style={{ display: 'flex', gap: '100px', alignItems: 'center' }}>
                                {/* PLAYER PHOTO BOX */}
                                <div style={{ position: 'relative' }}>
                                    <motion.div 
                                        animate={{ scale: [1, 1.01, 1] }}
                                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                        style={{ 
                                            width: '680px', 
                                            height: '840px', 
                                            borderRadius: '60px', 
                                            overflow: 'hidden', 
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            boxShadow: `0 30px 100px rgba(0, 0, 0, 0.8), 0 0 80px ${COLORS.accentGlow}`,
                                            background: '#050505',
                                            position: 'relative'
                                        }}
                                    >
                                        <img 
                                            src={fixPhotoUrl(currentPlayer.photo_url, currentPlayer.first_name)} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                            alt="" 
                                            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPlayer.first_name}`; }}
                                        />
                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 25%, transparent 100%)' }} />
                                    </motion.div>

                                    {/* SOLD STAMP */}
                                    <AnimatePresence>
                                        {showStamp && (
                                            <motion.div
                                                initial={{ scale: 4, opacity: 0, rotate: -45, x: '-50%', y: '-50%' }}
                                                animate={{ scale: 1, opacity: 1, rotate: -25, x: '-50%', y: '-50%' }}
                                                style={{
                                                    position: 'absolute',
                                                    top: '40%',
                                                    left: '50%',
                                                    zIndex: 200,
                                                    pointerEvents: 'none',
                                                    width: '800px',
                                                }}
                                            >
                                                <img 
                                                    src="/arpanam-stamp.png" 
                                                    style={{ width: '100%', height: 'auto', filter: 'drop-shadow(0 0 40px rgba(0,0,0,0.9))' }} 
                                                    alt="SOLD" 
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* PLAYER INFO BOX */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', minWidth: '800px' }}>
                                    <motion.div
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        <h1 style={{ 
                                            fontSize: '10rem', 
                                            fontWeight: 950, 
                                            margin: 0, 
                                            lineHeight: 1,
                                            letterSpacing: '-2px',
                                            background: 'linear-gradient(to bottom, #ffffff 50%, #888888 100%)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            textShadow: '0 20px 40px rgba(0,0,0,0.5)'
                                        } as any}>
                                            {currentPlayer.first_name.toUpperCase()}
                                            <br />
                                            {currentPlayer.last_name.toUpperCase()}
                                        </h1>
                                        <div style={{ 
                                            display: 'inline-block',
                                            marginTop: '20px',
                                            padding: '15px 40px',
                                            background: COLORS.electricBlue,
                                            color: COLORS.bg,
                                            fontSize: '2rem',
                                            fontWeight: 900,
                                            borderRadius: '15px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '5px'
                                        }}>
                                            {currentPlayer.category || 'PLAYER'}
                                        </div>
                                    </motion.div>

                                    <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                                        <div style={{ 
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', 
                                            padding: '30px 50px', 
                                            borderRadius: '30px', 
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            backdropFilter: 'blur(20px)'
                                        }}>
                                            <div style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.5)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '5px' }}>Base Price</div>
                                            <div style={{ fontSize: '4rem', fontWeight: 950 }}>{currentPlayer.base_price} <span style={{ fontSize: '2rem', color: COLORS.electricBlue }}>PUSHP</span></div>
                                        </div>
                                        
                                        {currentPlayer.was_present_kc3 && (
                                            <div style={{ 
                                                background: 'rgba(0,210,255,0.03)', 
                                                padding: '30px 50px', 
                                                borderRadius: '30px', 
                                                border: '1px solid rgba(0,210,255,0.15)',
                                                backdropFilter: 'blur(20px)'
                                            }}>
                                                <div style={{ fontSize: '1.2rem', color: COLORS.electricBlue, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '5px' }}>Last KC3 Status</div>
                                                <div style={{ fontSize: '4rem', fontWeight: 950 }}>{currentPlayer.was_present_kc3.toUpperCase()}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* LIVE BIDDING BOX */}
                                    <AnimatePresence mode="wait">
                                        {!showStamp && (
                                            <motion.div 
                                                key="bidding"
                                                initial={{ y: 50, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                style={{ 
                                                    marginTop: '20px', 
                                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 100%)', 
                                                    padding: '60px', 
                                                    borderRadius: '50px', 
                                                    border: `3px solid ${highestBidTeam ? COLORS.neonGreen : 'rgba(255,255,255,0.1)'}`,
                                                    boxShadow: highestBidTeam ? `0 0 80px rgba(57, 255, 20, 0.15)` : '0 0 40px rgba(0,0,0,0.5)',
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    backdropFilter: 'blur(30px)'
                                                }}
                                            >
                                                <div style={{ fontSize: '1.8rem', color: highestBidTeam ? COLORS.neonGreen : COLORS.electricBlue, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '8px', marginBottom: '25px' }}>
                                                    {highestBidTeam ? 'LEADING TEAM' : 'WAITING FOR BIDS'}
                                                </div>
                                                
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '30px' }}>
                                                    <motion.div 
                                                        key={auctionState?.current_highest_bid}
                                                        initial={{ y: 20, opacity: 0 }}
                                                        animate={{ y: 0, opacity: 1 }}
                                                        style={{ fontSize: '12rem', fontWeight: 950, lineHeight: 0.9, color: COLORS.white }}
                                                    >
                                                        {auctionState?.current_highest_bid || 0}
                                                    </motion.div>
                                                    <div style={{ fontSize: '4rem', fontWeight: 950, color: highestBidTeam ? COLORS.neonGreen : 'rgba(255,255,255,0.2)' }}>PUSHP</div>
                                                </div>

                                                {highestBidTeam && (
                                                    <motion.div 
                                                        initial={{ x: -30, opacity: 0 }}
                                                        animate={{ x: 0, opacity: 1 }}
                                                        style={{ marginTop: '40px', display: 'flex', alignItems: 'center', gap: '30px' }}
                                                    >
                                                        <div style={{ width: '25px', height: '25px', borderRadius: '50%', background: COLORS.neonGreen, boxShadow: `0 0 30px ${COLORS.neonGreen}` }} />
                                                        <div style={{ fontSize: '5rem', fontWeight: 950, color: COLORS.neonGreen, letterSpacing: '2px' }}>{highestBidTeam.name.toUpperCase()}</div>
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* SOLD BANNER */}
                            <AnimatePresence>
                                {showSoldBanner && highestBidTeam && (
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        style={{
                                            marginTop: '80px',
                                            textAlign: 'center',
                                            zIndex: 300,
                                            width: '100%'
                                        }}
                                    >
                                        <div style={{ 
                                            fontSize: '9rem', 
                                            fontWeight: 950, 
                                            color: COLORS.brightYellow, 
                                            textShadow: `0 0 60px rgba(255, 255, 0, 0.5)`,
                                            background: 'linear-gradient(to right, transparent, rgba(255, 255, 0, 0.1), rgba(255, 255, 0, 0.2), rgba(255, 255, 0, 0.1), transparent)',
                                            padding: '60px 150px',
                                            borderRadius: '100px',
                                            borderTop: '2px solid rgba(255, 255, 0, 0.3)',
                                            borderBottom: '2px solid rgba(255, 255, 0, 0.3)',
                                            boxShadow: '0 50px 100px rgba(0,0,0,0.9)',
                                            backdropFilter: 'blur(20px)',
                                            whiteSpace: 'nowrap'
                                        } as any}>
                                            SOLD TO <span style={{ color: COLORS.brightYellow }}>{highestBidTeam.name.toUpperCase()}</span> FOR {auctionState.current_highest_bid} PUSHP
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* BID NOTIFICATIONS (BOTTOM RIGHT) */}
            <div style={{ position: 'fixed', bottom: '160px', right: '60px', display: 'flex', flexDirection: 'column', gap: '25px', zIndex: 1000, pointerEvents: 'none' }}>
                <AnimatePresence>
                    {bidNotifications.map((n) => (
                        <motion.div
                            key={n.id}
                            initial={{ opacity: 0, x: 200, rotate: 10 }}
                            animate={{ opacity: 1, x: 0, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.5, filter: 'blur(20px)' }}
                            style={{
                                background: 'linear-gradient(to right, rgba(0,0,0,0.9), rgba(26,26,26,0.9))',
                                color: COLORS.white,
                                borderLeft: `10px solid ${COLORS.electricBlue}`,
                                boxShadow: `0 20px 50px rgba(0,0,0,0.8)`,
                                padding: '40px 60px',
                                borderRadius: '30px',
                                fontSize: '2.5rem',
                                fontWeight: 950,
                                backdropFilter: 'blur(30px)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '30px'
                            }}
                        >
                            <motion.div 
                                animate={{ scale: [1, 1.5, 1] }} 
                                transition={{ duration: 0.5 }}
                                style={{ width: '20px', height: '20px', borderRadius: '50%', background: COLORS.electricBlue, boxShadow: `0 0 20px ${COLORS.electricBlue}` }} 
                            />
                            {n.message}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* BOTTOM TICKER */}
            <div style={{ 
                position: 'fixed', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                height: '120px', 
                background: 'rgba(0,0,0,0.98)', 
                borderTop: '4px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                zIndex: 500
            }}>
                <div style={{ display: 'flex', whiteSpace: 'nowrap', width: '100%' }}>
                    <div className="ticker-content" style={{ display: 'flex', alignItems: 'center', animation: 'ticker-scroll 30s linear infinite' }}>
                        {[1, 2, 3, 4].map(i => (
                            <span key={i} style={{ 
                                fontSize: '4rem', 
                                fontWeight: 950, 
                                color: COLORS.white, 
                                letterSpacing: '15px', 
                                paddingRight: '150px',
                                background: `linear-gradient(to bottom, #fff 0%, #aaa 100%)`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            } as any}>
                                {BROADCAST_NAME}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
