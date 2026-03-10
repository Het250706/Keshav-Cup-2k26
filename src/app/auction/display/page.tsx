'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fixPhotoUrl } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, Hammer } from 'lucide-react';
import { getPurplePushp } from '@/lib/auction-logic';

export default function DisplayAuctionPage() {
    const [auctionState, setAuctionState] = useState<any>(null);
    const [currentPlayer, setCurrentPlayer] = useState<any>(null);
    const [highestBidTeam, setHighestBidTeam] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const { data: stateData } = await supabase.from('auction_state').select('*').single();
            if (stateData) {
                setAuctionState(stateData);
                if (stateData.current_player_id) {
                    const { data: playerData } = await supabase.from('players').select('*').eq('id', stateData.current_player_id).single();
                    setCurrentPlayer(playerData);
                } else {
                    setCurrentPlayer(null);
                }
                if (stateData.highest_bid_team_id) {
                    const { data: teamData } = await supabase.from('teams').select('name').eq('id', stateData.highest_bid_team_id).single();
                    setHighestBidTeam(teamData);
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
        const stateSub = supabase.channel('display_auction_realtime_v3')
            .on('postgres_changes', { event: '*', table: 'auction_state', schema: 'public' }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(stateSub); };
    }, []);

    const formatPushp = (amount: number) => {
        const purple = getPurplePushp(amount);
        return `${amount.toLocaleString()} Pushp${purple ? ` (${purple} Purple)` : ''}`;
    };

    if (loading) return null;

    return (
        <main style={{ height: '100vh', width: '100vw', background: '#000', color: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Ambient Background */}
            <div style={{ position: 'fixed', inset: 0, opacity: 0.15 }}>
                <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, var(--primary) 0%, transparent 60%)', filter: 'blur(120px)' }} />
                <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, #ff5e00 0%, transparent 60%)', filter: 'blur(120px)' }} />
            </div>

            {/* Header */}
            <div style={{ height: '120px', background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(30px)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 80px', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                    <div style={{ background: 'var(--primary)', width: '60px', height: '60px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px var(--primary-glow)' }}>
                        <Trophy size={40} color="#000" strokeWidth={3} />
                    </div>
                    <div>
                        <div style={{ fontSize: '2.8rem', fontWeight: 950, letterSpacing: '3px', lineHeight: 1 }}>KESHAV CUP</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '5px' }}>3.0 POWER EDITION</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800 }}>SESSION STATUS</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#00ff80' }}>LIVE BROADCAST</div>
                    </div>
                </div>
            </div>

            {/* Main Stage */}
            <div style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 80px' }}>
                <AnimatePresence mode="wait">
                    {auctionState?.status !== 'IDLE' && currentPlayer ? (
                        <motion.div
                            key={currentPlayer.id}
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            style={{ display: 'grid', gridTemplateColumns: 'minmax(500px, 0.8fr) 1fr', gap: '100px', width: '100%', maxWidth: '1800px', alignItems: 'center' }}
                        >
                            {/* Player Photo */}
                            <div style={{ position: 'relative' }}>
                                <motion.div animate={{ y: [0, -15, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} style={{ width: '550px', height: '700px', border: '5px solid var(--primary)', borderRadius: '40px', overflow: 'hidden', boxShadow: '0 50px 100px rgba(0,0,0,0.9), 0 0 60px rgba(255,215,0,0.2)', background: '#050505' }}>
                                    <img src={fixPhotoUrl(currentPlayer.photo_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                </motion.div>
                                <div style={{ position: 'absolute', bottom: '-30px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: '#000', padding: '18px 60px', borderRadius: '60px', fontWeight: 950, fontSize: '1.8rem', boxShadow: '0 20px 50px rgba(255,215,0,0.5)', whiteSpace: 'nowrap' }}>
                                    {currentPlayer.cricket_skill.toUpperCase()}
                                </div>
                            </div>

                            {/* Player Info */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                                <div>
                                    <div style={{ fontSize: '1.5rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '6px', marginBottom: '15px' }}>NOW ON AUCTION</div>
                                    <h1 style={{ fontSize: '8rem', fontWeight: 950, lineHeight: 0.85, letterSpacing: '-4px' }}>
                                        {currentPlayer.first_name.toUpperCase()}<br />
                                        <span style={{ color: 'var(--primary)' }}>{currentPlayer.last_name.toUpperCase()}</span>
                                    </h1>
                                    <p style={{ fontSize: '1.8rem', marginTop: '30px', color: 'var(--text-muted)', fontWeight: 800 }}>LAST KC PARTICIPATION: <span style={{ color: '#fff' }}>{currentPlayer.was_present_kc3}</span></p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px' }}>
                                    <motion.div layout style={{ background: 'rgba(255,255,255,0.03)', padding: '50px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ fontSize: '1.4rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '2px', marginBottom: '15px' }}>CURRENT HIGHEST BID</div>
                                        <motion.div key={auctionState.current_highest_bid} initial={{ scale: 1.2, color: 'var(--primary)' }} animate={{ scale: 1, color: '#fff' }} style={{ fontSize: '7rem', fontWeight: 950, letterSpacing: '-2px', lineHeight: 1 }}>
                                            {formatPushp(auctionState.current_highest_bid || 0)}
                                        </motion.div>
                                        {highestBidTeam && (
                                            <div style={{ marginTop: '30px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                                <div style={{ width: '15px', height: '15px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 20px var(--primary-glow)' }} />
                                                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary)' }}>{highestBidTeam.name.toUpperCase()}</div>
                                            </div>
                                        )}
                                    </motion.div>

                                    <div style={{ background: auctionState.status === 'SOLD' ? '#00ff80' : 'var(--primary)', color: '#000', padding: '40px', borderRadius: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', boxShadow: '0 30px 80px rgba(255,215,0,0.2)' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '10px', opacity: 0.6 }}>AUCTION STATUS</div>
                                        <div style={{ fontSize: '3.5rem', fontWeight: 950, lineHeight: 1 }}>{auctionState.bidding_status.toUpperCase()}</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div style={{ textAlign: 'center' }}>
                            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 4, repeat: Infinity }}><Zap size={180} color="var(--primary)" /></motion.div>
                            <h2 style={{ fontSize: '5rem', fontWeight: 950, marginTop: '50px', letterSpacing: '5px' }}>NEXT PLAYER IS ARRIVING</h2>
                            <p style={{ fontSize: '2.5rem', color: 'var(--text-muted)', fontWeight: 800 }}>GET YOUR PUSHP POINTS READY</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* SOLD OVERLAY (FULL SCREEN) */}
            <AnimatePresence>
                {auctionState?.status === 'SOLD' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.div initial={{ scale: 0.5, y: 100 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring' }} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '15rem' }}>🔨</div>
                            <div style={{ fontSize: '10rem', fontWeight: 950, color: '#00ff80', textShadow: '0 0 100px rgba(0,255,128,0.5)' }}>SOLD</div>
                            <div style={{ fontSize: '3rem', fontWeight: 900, marginTop: '20px' }}>{currentPlayer?.first_name} {currentPlayer?.last_name} → {highestBidTeam?.name}</div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{ height: '90px', background: 'var(--primary)', color: '#000', zIndex: 10, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 950, letterSpacing: '8px', animation: 'marquee 25s linear infinite' }}>
                    KESHAV CUP 3.0 PLAYER AUCTION • 5000 PUSHP LIMIT • SQUAD SIZE: 9 • JAY SWAMINARAYAN • KESHAV CUP 3.0 PLAYER AUCTION • 5000 PUSHP LIMIT • SQUAD SIZE: 9 • JAY SWAMINARAYAN •
                </div>
            </div>

            <style jsx>{`
                @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
            `}</style>
        </main>
    );
}
