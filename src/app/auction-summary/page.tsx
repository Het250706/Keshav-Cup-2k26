'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Trophy, Zap, Users, History, TrendingUp, CreditCard, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuctionSummary() {
    const [players, setPlayers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [bidHistory, setBidHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'dark' | 'neon' | 'gold' | 'minimal'>('dark');
    const [theaterMode, setTheaterMode] = useState(false);

    useEffect(() => {
        fetchData();

        const broadcastChannel = supabase.channel('auction_arena_realtime')
            .on('broadcast', { event: 'bid' }, (payload: any) => {
                setAuctionState((prev: any) => ({
                    ...prev,
                    current_highest_bid: payload.payload.amount,
                    last_bid_team_id: payload.payload.team_id
                }));
            })
            .subscribe();

        const stateSub = supabase.channel('summary_sync')
            .on('postgres_changes' as any, { event: '*', table: 'auction_state' }, (payload: any) => {
                setAuctionState(payload.new);
                if (payload.new.current_player_id) fetchBidHistory(payload.new.current_player_id);
            })
            .on('postgres_changes' as any, { event: '*', table: 'players' }, () => fetchData())
            .on('postgres_changes' as any, { event: '*', table: 'teams' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(stateSub);
            supabase.removeChannel(broadcastChannel);
        };
    }, []);

    const fetchData = async () => {
        const { data: p } = await supabase.from('players').select('*').order('updated_at', { ascending: false });
        const { data: t } = await supabase.from('teams').select('*').order('remaining_budget', { ascending: false });
        const { data: s } = await supabase.from('auction_state').select('*').single();

        if (p) setPlayers(p);
        if (t) setTeams(t);
        if (s) {
            setAuctionState(s);
            if (s.current_player_id) fetchBidHistory(s.current_player_id);
        }
        setLoading(false);
    };

    const fetchBidHistory = async (playerId: string) => {
        const { data } = await supabase.from('bids').select('*, teams(name)').eq('player_id', playerId).order('created_at', { ascending: false }).limit(5);
        if (data) setBidHistory(data);
    };

    const soldPlayers = players.filter(p => p.auction_status === 'sold');
    const currentPlayer = players.find(p => p.id === auctionState?.current_player_id);

    const getThemeStyles = () => {
        switch (theme) {
            case 'neon': return { bg: '#000', primary: '#00f2ff', glass: 'rgba(0, 242, 255, 0.05)', border: 'rgba(0, 242, 255, 0.2)', text: '#fff', muted: '#888' };
            case 'gold': return { bg: '#050505', primary: '#FFD700', glass: 'rgba(255, 215, 0, 0.03)', border: 'rgba(255, 215, 0, 0.3)', text: '#fff', muted: '#aaa' };
            case 'minimal': return { bg: '#fff', primary: '#000', glass: 'rgba(0, 0, 0, 0.02)', border: 'rgba(0, 0, 0, 0.1)', text: '#000', muted: '#666' };
            default: return { bg: '#000', primary: '#FFD700', glass: 'rgba(255, 255, 255, 0.03)', border: 'rgba(255, 255, 255, 0.1)', text: '#fff', muted: '#888' };
        }
    };

    const st = getThemeStyles();

    if (loading) return <div style={{ height: '100vh', background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: st.primary, fontWeight: 900 }}>LOADING SUMMARY...</div>;

    return (
        <main style={{ minHeight: '100vh', background: st.bg, color: st.text, transition: 'all 0.5s ease', paddingBottom: theaterMode ? '0' : '50px', overflow: theaterMode ? 'hidden' : 'auto' }}>
            {!theaterMode && <Navbar />}

            <div className="container-responsive" style={{ padding: theaterMode ? '0' : '20px', maxWidth: theaterMode ? '100vw' : '1600px', margin: '0 auto', height: theaterMode ? '100vh' : 'auto', display: theaterMode ? 'flex' : 'block', flexDirection: 'column' }}>
                {!theaterMode && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                        <div>
                            <h1 className="title-gradient" style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)', fontWeight: 950, letterSpacing: '-2px', color: st.text }}>KESHAV CUP - LIVE SUMMARY</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff80' }} className="pulse" />
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: st.muted }}>ZERO-LAG BID FEED (BROADCAST ON)</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <button onClick={() => setTheaterMode(true)} className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.75rem', fontWeight: 900, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={16} fill="currentColor" /> ENTER THEATER MODE (PROJECTOR)
                            </button>
                            <div className="glass" style={{ padding: '6px', borderRadius: '15px', display: 'flex', gap: '5px', background: st.glass, borderColor: st.border }}>
                                {(['dark', 'neon', 'gold', 'minimal'] as const).map(t => (
                                    <button key={t} onClick={() => setTheme(t)} style={{ padding: '8px 15px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', background: theme === t ? st.primary : 'transparent', color: theme === t ? (st.bg === '#fff' ? '#fff' : '#000') : st.text, border: 'none' }}>{t}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {theaterMode ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: st.primary }}>OFFICIAL BIDDING ARENA</h2>
                                <h1 style={{ fontSize: '3rem', fontWeight: 950 }}>KESHAV CUP 2026</h1>
                            </div>
                            <button onClick={() => setTheaterMode(false)} className="btn-secondary" style={{ fontSize: '0.7rem' }}>EXIT THEATER</button>
                        </div>
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '50px' }}>
                            <div className="glass" style={{ padding: '50px', borderRadius: '40px', border: `2px solid ${st.primary}30` }}>
                                <AnimatePresence mode="wait">
                                    {currentPlayer ? (
                                        <motion.div key={currentPlayer.id} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                                                <div style={{ width: '320px', height: '420px', borderRadius: '30px', overflow: 'hidden', border: `2px solid ${st.primary}` }}>
                                                    <img src={currentPlayer.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPlayer.first_name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                                </div>
                                                <div>
                                                    <div style={{ color: st.primary, fontWeight: 950, fontSize: '1.5rem', letterSpacing: '10px' }}>{currentPlayer.category?.toUpperCase()}</div>
                                                    <h1 style={{ fontSize: '6rem', fontWeight: 950, margin: '0' }}>{currentPlayer.first_name}</h1>
                                                    <h1 style={{ fontSize: '6rem', fontWeight: 950, margin: '0', opacity: 0.8 }}>{currentPlayer.last_name}</h1>
                                                </div>
                                            </div>
                                            <div style={{ background: `${st.primary}10`, padding: '40px', borderRadius: '35px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.5rem', color: st.muted, fontWeight: 900 }}>CURRENT BID</div>
                                                <div style={{ fontSize: '12rem', fontWeight: 950, color: st.primary, lineHeight: 0.8 }}>₹{((auctionState.current_highest_bid || currentPlayer.base_price) / 10000000).toFixed(2)}<span style={{ fontSize: '4rem' }}>Cr</span></div>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontWeight: 950, opacity: 0.2 }}>WAITING...</div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="glass" style={{ padding: '40px', borderRadius: '40px' }}>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 950, color: st.primary, marginBottom: '30px' }}>FRANCHISE STANDINGS</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {teams.map((t, i) => (
                                        <div key={t.id} style={{ padding: '20px 30px', borderRadius: '25px', background: `${st.primary}08`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 950, fontSize: '1.8rem' }}>{t.name}</span>
                                            <span style={{ fontWeight: 950, color: st.primary, fontSize: '2rem' }}>₹{(t.remaining_budget / 10000000).toFixed(1)}Cr</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: '30px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="glass" style={{ padding: '30px', borderRadius: '35px', border: `1px solid ${st.border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00ff80' }} className="pulse" />
                                    <h2 style={{ fontSize: '1.2rem', fontWeight: 900 }}>Active Floor</h2>
                                </div>
                                <AnimatePresence mode="wait">
                                    {currentPlayer ? (
                                        <div style={{ display: 'flex', gap: '35px', alignItems: 'center' }}>
                                            <div style={{ width: '200px', height: '260px', borderRadius: '25px', overflow: 'hidden', border: `1px solid ${st.primary}` }}>
                                                <img src={currentPlayer.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPlayer.first_name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h1 style={{ fontSize: '3rem', fontWeight: 950 }}>{currentPlayer.first_name} {currentPlayer.last_name}</h1>
                                                <div style={{ fontSize: '4.5rem', fontWeight: 950, color: st.primary }}>₹ {((auctionState.current_highest_bid || currentPlayer.base_price) / 10000000).toFixed(2)} Cr</div>
                                            </div>
                                        </div>
                                    ) : <div style={{ padding: '80px 0', textAlign: 'center' }}>WAITING...</div>}
                                </AnimatePresence>
                            </div>
                            <div className="glass" style={{ padding: '30px', borderRadius: '35px' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 950, marginBottom: '20px' }}>Sold Gallery</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                    {soldPlayers.slice(0, 6).map(p => (
                                        <div key={p.id} style={{ padding: '12px 18px', background: `${st.primary}05`, borderRadius: '18px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 900 }}>{p.first_name} {p.last_name}</span>
                                            <span style={{ fontWeight: 950, color: '#00ff80' }}>₹ {(p.sold_price / 10000000).toFixed(2)} Cr</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="glass" style={{ padding: '30px', borderRadius: '35px' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 950, marginBottom: '25px' }}>Purse Standings</h2>
                            {teams.map(t => (
                                <div key={t.id} style={{ padding: '12px 18px', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontWeight: 900 }}>{t.name}</span>
                                    <span style={{ fontWeight: 950, color: st.primary }}>₹ {(t.remaining_budget / 10000000).toFixed(2)} Cr</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <style jsx>{`
                .pulse { animation: pulse-glow 2s infinite; }
                @keyframes pulse-glow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.3); } }
                .glass { backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); }
                .title-gradient { background: linear-gradient(135deg, #fff 0%, #FFD700 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            `}</style>
        </main>
    );
}
