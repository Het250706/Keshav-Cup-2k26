'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import RoleGuard from '@/components/RoleGuard';
import { fixPhotoUrl } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Gavel,
    Users,
    ChevronRight,
    RotateCcw,
    Search,
    Loader2,
    Award,
    Hammer,
    Zap,
    History
} from 'lucide-react';
import { getPurplePushp, MAX_SQUAD_SIZE } from '@/lib/auction-logic';

export default function AdminAuctionPage() {
    return (
        <RoleGuard allowedRole="admin">
            <AdminAuctionContent />
        </RoleGuard>
    );
}

function AdminAuctionContent() {
    const [players, setPlayers] = useState<any[]>([]);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showPlayerSelect, setShowPlayerSelect] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSoldAnimating, setIsSoldAnimating] = useState(false);

    const fetchData = async () => {
        try {
            const [playersRes, stateRes, teamsRes] = await Promise.all([
                supabase.from('players').select('*').order('created_at', { ascending: false }),
                supabase.from('auction_state').select('*').single(),
                supabase.from('teams').select('*').order('name')
            ]);

            if (playersRes.data) setPlayers(playersRes.data);
            if (stateRes.data) setAuctionState(stateRes.data);
            if (teamsRes.data) {
                // Fetch squad counts for each team
                const teamsWithSquadCount = await Promise.all(teamsRes.data.map(async (t: any) => {
                    const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('team_id', t.id).eq('auction_status', 'sold');
                    return { ...t, squad_count: count || 0 };
                }));
                setTeams(teamsWithSquadCount);
            }
        } catch (err) {
            console.error('Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const stateSub = supabase.channel('admin_auction_realtime_v3')
            .on('postgres_changes', { event: '*', table: 'auction_state', schema: 'public' }, (p: any) => {
                setAuctionState(p.new);
                if ((p.new as any).status === 'SOLD') {
                    setIsSoldAnimating(true);
                    setTimeout(() => setIsSoldAnimating(false), 3000);
                }
            })
            .on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, () => fetchData())
            .on('postgres_changes', { event: '*', table: 'teams', schema: 'public' }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
    }, []);

    const handleAction = async (action: string, payload: any = {}) => {
        setActionLoading(true);
        try {
            let url = '/api/auction/v3/control';
            if (action === 'sell') url = '/api/auction/v3/sell';

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Action failed');

            if (action === 'start') setShowPlayerSelect(false);
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
            <Loader2 className="animate-spin" size={48} color="var(--primary)" />
        </div>
    );

    const currentPlayer = players.find(p => p.id === auctionState?.current_player_id);
    const winningTeam = teams.find(t => t.id === auctionState?.highest_bid_team_id);
    const pendingPlayers = players.filter(p => p.auction_status === 'pending');
    const filteredPlayers = pendingPlayers.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()));

    const formatPushp = (amount: number) => {
        const purple = getPurplePushp(amount);
        return `${amount.toLocaleString()} Pushp${purple ? ` (${purple} Purple Pushp)` : ''}`;
    };

    return (
        <main style={{ minHeight: '100vh', background: '#050505', color: '#fff', paddingBottom: '100px' }}>
            <Navbar />

            <div className="container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
                <div style={{ padding: '30px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-1px' }}>
                            <span style={{ color: 'var(--primary)' }}>AUCTION</span> CONSOLE
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Official Tournament Bidding Engine</p>
                    </div>
                    <button onClick={() => handleAction('reset')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}>
                        <RotateCcw size={18} /> RESET
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: '40px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        {currentPlayer ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass" style={{ padding: '40px', borderRadius: '30px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,215,0,0.1)', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '30px', right: '30px', zIndex: 10 }}>
                                    <div style={{ padding: '10px 25px', borderRadius: '50px', background: 'var(--primary)', color: '#000', fontWeight: 900, fontSize: '1.1rem' }}>
                                        {auctionState?.bidding_status || 'PENDING'}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '40px' }}>
                                    <div style={{ width: '300px', height: '380px', borderRadius: '24px', overflow: 'hidden', border: '2px solid var(--primary)', background: '#111' }}>
                                        <img
                                            src={fixPhotoUrl(currentPlayer.photo_url, currentPlayer.first_name)}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            alt=""
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPlayer.first_name}`;
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h2 style={{ fontSize: '4rem', fontWeight: 950, lineHeight: 1, marginBottom: '20px' }}>{currentPlayer.first_name} <span style={{ color: 'var(--primary)' }}>{currentPlayer.last_name}</span></h2>
                                        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800 }}>{currentPlayer.cricket_skill}</div>
                                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800 }}>KC3: {currentPlayer.was_present_kc3}</div>
                                        </div>
                                        <div style={{ background: 'rgba(0,0,0,0.4)', padding: '30px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '1px' }}>CURRENT BID</div>
                                            <div style={{ fontSize: '4rem', fontWeight: 950 }}>{formatPushp(auctionState?.current_highest_bid || 0)}</div>
                                            {winningTeam && <div style={{ marginTop: '10px', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)' }}>Highest Bidder: <span style={{ color: 'var(--primary)' }}>{winningTeam.name}</span></div>}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
                                    <button onClick={() => handleAction('status_update', { bidding_status: 'GOING ONCE' })} className="btn-secondary" style={{ padding: '15px', fontWeight: 900 }}>GOING ONCE</button>
                                    <button onClick={() => handleAction('status_update', { bidding_status: 'GOING TWICE' })} className="btn-secondary" style={{ padding: '15px', fontWeight: 900 }}>GOING TWICE</button>
                                    <button onClick={() => handleAction('sell', { player_id: currentPlayer.id })} disabled={!winningTeam} className="btn-primary" style={{ padding: '15px', fontWeight: 950, fontSize: '1.1rem' }}>🔨 SOLD</button>
                                    <button onClick={() => handleAction('unsold', { player_id: currentPlayer.id })} className="btn-secondary" style={{ padding: '15px', fontWeight: 900, color: '#ff4b4b' }}>UNSOLD</button>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="glass" style={{ height: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '30px' }}>
                                <Hammer size={100} style={{ opacity: 0.1, marginBottom: '20px' }} />
                                <button onClick={() => setShowPlayerSelect(true)} className="btn-primary" style={{ padding: '15px 50px', fontSize: '1.2rem', fontWeight: 900 }}>SELECT NEXT PLAYER</button>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                        <div className="glass" style={{ padding: '25px', borderRadius: '25px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Award size={20} color="var(--primary)" /> LEADERBOARD (9 SQUAD LIMIT)
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {teams.map(t => (
                                    <div key={t.id} style={{ padding: '15px', borderRadius: '15px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 800 }}>{t.name}</span>
                                            <span style={{ fontWeight: 900, color: 'var(--primary)' }}>{t.remaining_budget} P</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                            <span>Squad Size: {t.squad_count} / {MAX_SQUAD_SIZE}</span>
                                            <span>{(t.squad_count / 9 * 100).toFixed(0)}% Full</span>
                                        </div>
                                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                                            <div style={{ width: `${(t.squad_count / 9) * 100}%`, height: '100%', background: t.squad_count >= 9 ? '#ff4b4b' : 'var(--primary)' }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SOLD OVERLAY */}
            <AnimatePresence>
                {isSoldAnimating && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,255,128,0.2)', backdropFilter: 'blur(20px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <motion.div initial={{ scale: 0.5, y: 50 }} animate={{ scale: 1, y: 0 }} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '12rem' }}>🔨</div>
                            <h2 style={{ fontSize: '8rem', fontWeight: 950, color: '#fff', textShadow: '0 0 50px rgba(0,255,128,0.8)' }}>SOLD</h2>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PLAYER SELECT DRAWER */}
            <AnimatePresence>
                {showPlayerSelect && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPlayerSelect(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, backdropFilter: 'blur(10px)' }} />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: '500px', background: '#0a0a0a', zIndex: 1001, padding: '40px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 950, marginBottom: '30px' }}>SELECT PLAYER</h2>
                            <div style={{ position: 'relative', marginBottom: '30px' }}>
                                <Search style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                                <input type="text" placeholder="Search player..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '15px 15px 15px 50px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                                {filteredPlayers.map(p => (
                                    <div key={p.id} onClick={() => handleAction('start', { player_id: p.id })} style={{ padding: '12px', borderRadius: '15px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', border: '1px solid transparent' }} className="select-card">
                                        <div style={{ width: '45px', height: '45px', borderRadius: '10px', overflow: 'hidden' }}><img src={fixPhotoUrl(p.photo_url, p.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }} /></div>
                                        <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{p.first_name} {p.last_name}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.cricket_skill}</div></div>
                                        <ChevronRight size={18} color="var(--primary)" />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            <style jsx>{`
                .btn-primary:active { transform: scale(0.98); }
                .select-card:hover { border-color: var(--primary); background: rgba(255,215,0,0.05) !important; }
            `}</style>
        </main>
    );
}
