'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
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

const DisplayAuctionPage = memo(function DisplayAuctionPage() {
    // --- STATE ---
    const [state, setState] = useState<any>({
        auctionState: null,
        currentPlayer: null,
        highestBidTeam: null,
        loading: true,
        showStamp: false,
        showSoldBanner: false,
        playedSoldPlayerId: null
    });
    const [bidNotifications, setBidNotifications] = useState<any[]>([]);
    const [showSoldMessage, setShowSoldMessage] = useState(false);
    const [soldData, setSoldData] = useState<{ playerName: string, teamName: string, amount: number } | null>(null);

    // --- REFS ---
    const lastBidValueRef = useRef<number>(0);
    const hammerSoundRef = useRef<HTMLAudioElement | null>(null);
    const bidSoundRef = useRef<HTMLAudioElement | null>(null);
    const isFirstLoadRef = useRef(true);
    const preloadedImageRef = useRef<HTMLImageElement | null>(null);

    // --- HELPERS ---
    const fetchPlayer = useCallback(async (id: string) => {
        if (!id) return null;
        const { data } = await supabase
            .from('players')
            .select('id, first_name, last_name, photo_url, role, base_price, was_present_kc3')
            .eq('id', id)
            .single();
        return data;
    }, []);

    const fetchTeam = useCallback(async (id: string) => {
        if (!id) return null;
        const { data } = await supabase
            .from('teams')
            .select('name')
            .eq('id', id)
            .single();
    return data;
    }, []);

    const triggerSoldSequence = useCallback(async (finalState: any) => {
        const [player, team] = await Promise.all([
            finalState.current_player_id ? fetchPlayer(finalState.current_player_id) : Promise.resolve(null),
            finalState.highest_bid_team_id ? fetchTeam(finalState.highest_bid_team_id) : Promise.resolve(null)
        ]);
        
        // Populate Sold Message Data
        if (player) {
            setSoldData({
                playerName: `${player.first_name} ${player.last_name}`,
                teamName: team?.name || 'Unknown Team',
                amount: finalState.current_highest_bid || 0
            });
            setShowSoldMessage(true);
            
            // Clean up sequence aligned to 5 seconds
            setTimeout(() => {
                setShowSoldMessage(false);
                setState((prev: any) => ({
                    ...prev,
                    auctionState: { ...prev.auctionState, status: 'IDLE' },
                    currentPlayer: null,
                    highestBidTeam: null,
                    showStamp: false,
                    showSoldBanner: false,
                    playedSoldPlayerId: null,
                    loading: false
                }));
                setBidNotifications([]);
                lastBidValueRef.current = 0;
            }, 5000);
        }

        setState((prev: any) => ({ 
            ...prev, 
            auctionState: finalState, 
            currentPlayer: player, 
            highestBidTeam: team,
            showStamp: true,
            loading: false
        }));

        hammerSoundRef.current?.play().catch(() => {});
    }, [fetchPlayer, fetchTeam]);

    const fetchData = useCallback(async () => {
        try {
            const { data: stateData } = await supabase
                .from('auction_state')
                .select('status, current_player_id, highest_bid_team_id, current_highest_bid')
                .single();

            if (stateData) {
                const playerChanged = stateData.current_player_id !== state.auctionState?.current_player_id;

                if (stateData.status === 'SOLD') {
                    if (state.playedSoldPlayerId !== stateData.current_player_id) {
                        setState((prev: any) => ({ ...prev, playedSoldPlayerId: stateData.current_player_id }));
                        triggerSoldSequence(stateData);
                    }
                } else if (stateData.status === 'BIDDING') {
                    const [player, team] = await Promise.all([
                        playerChanged ? fetchPlayer(stateData.current_player_id) : Promise.resolve(state.currentPlayer),
                        fetchTeam(stateData.highest_bid_team_id)
                    ]);

                    setState((prev: any) => ({
                        ...prev,
                        auctionState: stateData,
                        currentPlayer: player,
                        highestBidTeam: team,
                        playedSoldPlayerId: null,
                        showStamp: false,
                        showSoldBanner: false,
                        loading: false
                    }));
                    
                    // Preload next player
                    if (stateData.current_player_id) {
                        try {
                            const { data: nextPlayers } = await supabase
                                .from('players')
                                .select('photo_url, first_name')
                                .is('team_id', null)
                                .neq('id', stateData.current_player_id)
                                .limit(1);
                            
                            if (nextPlayers?.[0]) {
                                const url = fixPhotoUrl(nextPlayers[0].photo_url, nextPlayers[0].first_name);
                                preloadedImageRef.current = new Image();
                                preloadedImageRef.current.src = url;
                            }
                        } catch (e) {}
                    }
                } else {
                    setState((prev: any) => ({
                        ...prev,
                        auctionState: stateData,
                        currentPlayer: null,
                        highestBidTeam: null,
                        playedSoldPlayerId: null,
                        showStamp: false,
                        showSoldBanner: false,
                        loading: false
                    }));
                }
                
                if (stateData.current_highest_bid > lastBidValueRef.current && stateData.status === 'BIDDING') {
                    if (!isFirstLoadRef.current) bidSoundRef.current?.play().catch(() => {});
                    lastBidValueRef.current = stateData.current_highest_bid;
                }
                isFirstLoadRef.current = false;
                setState((prev: any) => ({ ...prev, loading: false }));
            } else {
                setState((prev: any) => ({ ...prev, loading: false }));
            }
        } catch (err) {
            console.error('Fetch Error:', err);
            setState((prev: any) => ({ ...prev, loading: false }));
        }
    }, [state.auctionState, state.currentPlayer, state.playedSoldPlayerId, fetchPlayer, fetchTeam, triggerSoldSequence]);

    const handleNewBid = useCallback(async (bid: any) => {
        const { data: teamData } = await supabase.from('teams').select('name').eq('id', bid.team_id).single();
        const notification = {
            id: Date.now(),
            message: `${teamData?.name || 'A team'} placed a bid of ${bid.amount} Pushp`,
            team: teamData?.name
        };
        
        setBidNotifications((prev) => [...prev.slice(-2), notification]);
        bidSoundRef.current?.play().catch(() => {});

        setTimeout(() => {
            setBidNotifications((prev) => prev.filter(n => n.id !== notification.id));
        }, 4000);
    }, []);

    // --- INITIALIZATION ---
    useEffect(() => {
        hammerSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2143/2143-preview.mp3');
        bidSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');

        fetchData();

        const stateSub = supabase.channel('display_realtime_v6')
            .on('postgres_changes', { event: 'UPDATE', table: 'auction_state', schema: 'public' }, fetchData)
            .on('postgres_changes', { event: 'INSERT', table: 'bids', schema: 'public' }, (payload: any) => {
                handleNewBid(payload.new);
            })
            .subscribe();

        return () => { 
            supabase.removeChannel(stateSub);
        };
    }, [fetchData, handleNewBid]);


    if (state.loading) return null;

    const { auctionState, currentPlayer, highestBidTeam, showStamp, showSoldBanner } = state;
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
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                
                body {
                    font-family: 'Inter', sans-serif;
                    background-color: #020617;
                    margin: 0;
                    overflow: hidden;
                    -webkit-font-smoothing: antialiased;
                }

                .noise-overlay { will-change: transform; pointer-events: none; }
                .ticker-content { will-change: transform; }

                @keyframes ticker-scroll {
                    0% { transform: translate3d(0, 0, 0); }
                    100% { transform: translate3d(-50%, 0, 0); }
                }

                .ticker-content {
                    animation: ticker-scroll 30s linear infinite;
                }
            `}</style>
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
                <h1 
                    style={{ 
                        fontSize: '7.5rem', 
                        fontWeight: 900, 
                        color: '#ffffff', 
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '40px'
                    } as any}
                >
                    <img src="/logo.png" style={{ height: '110px', width: 'auto' }} />
                    <span>KESHAV CUP 4.0 PLAYER AUCTION</span>
                    <img src="/logo.png" style={{ height: '110px', width: 'auto' }} />
                </h1>
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
                    {showSoldMessage ? (
                        <motion.div
                            key="sold-message"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1, filter: 'blur(30px)' }}
                            style={{ 
                                background: 'rgba(255, 215, 0, 0.05)', 
                                border: '5px solid #FFD700', 
                                borderRadius: '80px', 
                                padding: '100px 150px', 
                                textAlign: 'center',
                                boxShadow: '0 0 150px rgba(255, 215, 0, 0.3)',
                                backdropFilter: 'blur(30px)',
                                zIndex: 200
                            }}
                        >
                            <motion.h1 
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 0.5, repeat: 3 }}
                                style={{ color: '#FFD700', fontSize: '15rem', fontWeight: 950, margin: 0, textShadow: '0 0 80px #FFD700' }}
                            >
                                SOLD!
                            </motion.h1>
                            <h2 style={{ fontSize: '7rem', fontWeight: 900, color: '#fff', margin: '20px 0' }}>{soldData?.playerName.toUpperCase()}</h2>
                            <h3 style={{ fontSize: '6rem', fontWeight: 800, color: '#FFD700' }}>TO: {soldData?.teamName.toUpperCase()}</h3>
                            <h4 style={{ fontSize: '5rem', fontWeight: 900, color: '#fff' }}>FOR: {soldData?.amount} PUSHP</h4>
                        </motion.div>
                    ) : (!isIdle && currentPlayer) ? (
                        <motion.div 
                            key={currentPlayer.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, filter: 'blur(30px)' }}
                            transition={{ duration: 0.5 }}
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
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', willChange: 'transform' }} 
                                            alt="" 
                                            loading="eager"
                                            fetchPriority="high"
                                            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPlayer.first_name}`; }}
                                        />
                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 25%, transparent 100%)', pointerEvents: 'none' }} />
                                    </motion.div>

                                    {/* SOLD STAMP */}
                                    <AnimatePresence>
                                        {showStamp && (
                                            <motion.div
                                                initial={{ scale: 4, opacity: 0.15, rotate: -45, x: '-50%', y: '-50%' }}
                                                animate={{ scale: 1, opacity: 1, rotate: -25, x: '-50%', y: '-50%' }}
                                                style={{
                                                    position: 'absolute',
                                                    top: '40%',
                                                    left: '50%',
                                                    zIndex: 10,
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
                                            fontSize: '13rem', 
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
                                            {currentPlayer.role || 'PLAYER'}
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
                                            <div style={{ fontSize: '5.5rem', fontWeight: 950 }}>{currentPlayer.base_price} <span style={{ fontSize: '3rem', color: COLORS.electricBlue }}>PUSHP</span></div>
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
                                                <div style={{ fontSize: '5.5rem', fontWeight: 950 }}>{currentPlayer.was_present_kc3.toUpperCase()}</div>
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
                                                        style={{ fontSize: '15rem', fontWeight: 950, lineHeight: 0.9, color: COLORS.white }}
                                                    >
                                                        {auctionState?.current_highest_bid || 0}
                                                    </motion.div>
                                                    <div style={{ fontSize: '5.5rem', fontWeight: 950, color: highestBidTeam ? COLORS.neonGreen : 'rgba(255,255,255,0.2)' }}>PUSHP</div>
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

                            {/* OLD SOLD BANNER (RETAINED FOR STAMP LOGIC BUT HIDDEN IF NEW OVERLAY IS ON) */}
                            <AnimatePresence>
                                {showSoldBanner && highestBidTeam && !showSoldMessage && (
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
                    ) : (
                        <motion.div
                            key="waiting-screen"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ textAlign: 'center', zIndex: 10 }}
                        >
                            <motion.img 
                                src="/logo.png" 
                                style={{ height: '150px', width: 'auto', marginBottom: '40px' }}
                                animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            />
                            <h1 style={{ 
                                color: '#FFD700', 
                                fontSize: '8rem', 
                                fontWeight: 950, 
                                margin: 0,
                                textShadow: '0 0 40px rgba(255, 215, 0, 0.3)',
                                letterSpacing: '10px'
                            }}>
                                AUCTION IN PROGRESS
                            </h1>
                            <h2 style={{ 
                                color: '#FFD700', 
                                fontSize: '3rem', 
                                fontWeight: 600, 
                                marginTop: '10px',
                                letterSpacing: '5px',
                                opacity: 0.7
                            }}>
                                JAY SWAMINARAYAN
                            </h2>
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
                <div className="ticker-content" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    animation: 'ticker-scroll 30s linear infinite', 
                    whiteSpace: 'nowrap',
                    willChange: 'transform'
                }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', paddingRight: '80px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: '100%' }}>
                                <img 
                                    src="/logo.png" 
                                    style={{ 
                                        height: '100px', 
                                        width: 'auto', 
                                        margin: '0 40px',
                                        verticalAlign: 'middle',
                                        display: 'inline-flex',
                                        alignItems: 'center'
                                    }} 
                                    alt="Logo"
                                />
                            </span>
                            <span style={{ 
                                fontSize: '5.5rem', 
                                fontWeight: 950, 
                                color: COLORS.white, 
                                letterSpacing: '18px', 
                                background: `linear-gradient(to bottom, #fff 0%, #aaa 100%)`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                display: 'inline-flex',
                                alignItems: 'center'
                            } as any}>
                                {BROADCAST_NAME}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
});

export default DisplayAuctionPage;
