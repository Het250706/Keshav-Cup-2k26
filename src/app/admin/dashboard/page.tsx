'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Trash2, X, Gavel, Users, UserPlus, Shield, LogOut, Zap, Shuffle, FileText, Download, Link as LinkIcon, FileSpreadsheet, ExternalLink, Settings, LayoutGrid, Hammer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import RoleGuard from '@/components/RoleGuard';
import { fixPhotoUrl } from '@/lib/utils';

export default function AdminDashboardPage() {
    return (
        <RoleGuard allowedRole="admin">
            <AdminDashboardContent />
        </RoleGuard>
    );
}

function AdminDashboardContent() {
    const thStyle: React.CSSProperties = { padding: '15px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' };
    const tdStyle: React.CSSProperties = { padding: '15px', fontSize: '0.9rem' };

    const [players, setPlayers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [sheetSyncing, setSheetSyncing] = useState(false);
    const router = useRouter();

    const fetchData = async () => {
        try {
            const [playersRes, stateRes, teamsRes] = await Promise.all([
                supabase.from('players').select('*').order('created_at', { ascending: false }),
                supabase.from('auction_state').select('*').single(),
                supabase.from('teams').select('*').order('name')
            ]);

            if (playersRes.data) setPlayers(playersRes.data);
            if (stateRes.data) setAuctionState(stateRes.data);
            if (teamsRes.data) setTeams(teamsRes.data);

            if (stateRes.error && stateRes.error.code !== 'PGRST116') {
                console.error('Auction State Error:', stateRes.error);
            }
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error('FetchData Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        fetchData();

        const channelId = `admin_dashboard_realtime_${Math.random()}`;
        const stateSub = supabase.channel(channelId)
            .on('postgres_changes' as any, { event: '*', table: 'auction_state', schema: 'public' }, () => fetchData())
            .on('postgres_changes' as any, { event: '*', table: 'players', schema: 'public' }, () => fetchData())
            .on('postgres_changes' as any, { event: '*', table: 'teams', schema: 'public' }, () => fetchData())
            .on('postgres_changes' as any, { event: '*', table: 'bids', schema: 'public' }, () => fetchData())
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(stateSub);
        };
    }, []);

    const controlAuction = async (action: string, playerId?: string) => {
        try {
            setSyncing(true);
            const url = action === 'start' ? '/api/auction/start' : '/api/auction/control';
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, player_id: playerId })
            });

            if (!res.ok) throw new Error('Auction action failed');
            // Optimistic refresh
            fetchData();
        } catch (err: any) {
            console.error('Auction Control Error:', err);
            alert('Action Failed: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const sellPlayer = async () => {
        if (!auctionState?.current_player_id || !auctionState?.highest_bid_team_id) {
            alert("No active player or no bids placed yet.");
            return;
        }

        try {
            const res = await fetch('/api/auction/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id: auctionState.current_player_id
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to assign player');

            alert('Player assigned successfully!');
            fetchData();
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const drawRandom = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auction/draw-random', { method: 'POST' });
            if (res.ok) {
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to draw random player');
            }
        } catch (err) {
            alert('Error drawing player');
        } finally {
            setLoading(false);
        }
    };

    const clearPool = async () => {
        if (!confirm('🚨 EMERGENCY ACTION: This will delete ALL players, ALL bids, and ALL match assignments. This is irreversible. "Temporary" means you will have to re-sync them from the Google Sheet. Continue?')) return;

        setSyncing(true);
        try {
            const res = await fetch('/api/admin/clear-pool', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                alert('✅ Player pool cleared successfully!');
                fetchData();
            } else {
                throw new Error(data.error || 'Failed to clear pool');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const auditBudgets = async () => {
        if (!confirm('Re-calculate all team budgets based on actual sold players? This will fix discrepancies caused by manual deletions.')) return;

        setSyncing(true);
        try {
            const res = await fetch('/api/admin/audit-budgets', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('✅ Team budgets synchronized successfully!');
                fetchData();
            } else {
                throw new Error(data.error || 'Audit failed');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const resetPurses = async () => {
        if (!confirm('🚨 RESET ALL PURSES? This will set every team\'s remaining budget to their MAXIMUM capacity, regardless of current players. Continue?')) return;

        setSyncing(true);
        try {
            const res = await fetch('/api/admin/reset-purses', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('✅ All team purses reset successfully!');
                fetchData();
            } else {
                throw new Error(data.error || 'Reset failed');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const currentPlayer = players.find(p => p.id === auctionState?.current_player_id);

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>LOADING CONSOLE...</div>;

    return (
        <>
            <main style={{ background: '#000', minHeight: '100vh' }}>
                <Navbar />

                <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.2rem)', fontWeight: 900 }}>Admin <span style={{ color: 'var(--primary)' }}>Control</span></h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{
                                    background: 'rgba(255, 75, 75, 0.1)',
                                    color: '#ff4b4b',
                                    border: '1px solid rgba(255, 75, 75, 0.3)',
                                    padding: '4px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                }}>LIVE CONSOLE</span>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Registrations: <b style={{ color: '#fff' }}>{players.length}</b></p>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                        {/* Register Box */}
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -5 }}
                            onClick={() => router.push('/register')}
                            className="glass"
                            style={{ padding: '25px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(255, 215, 0, 0.05)', border: '1px solid rgba(255, 215, 0, 0.2)' }}
                        >
                            <div style={{ background: 'var(--primary)', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <UserPlus size={28} color="#000" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '4px' }}>REGISTER</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Open Player Registration Form</p>
                            </div>
                        </motion.div>

                        {/* Registration Control Box */}
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -5 }}
                            onClick={() => router.push('/admin/registrations')}
                            className="glass"
                            style={{ padding: '25px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px' }}
                        >
                            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                                <Settings size={28} color="var(--primary)" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '4px' }}>REGISTRATION CONTROL</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Manage & Sync Registration Sheets</p>
                            </div>
                        </motion.div>

                        {/* Live Score Control Box */}
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -5 }}
                            onClick={() => router.push('/admin/live-score')}
                            className="glass"
                            style={{ padding: '25px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(0, 255, 128, 0.05)', border: '1px solid rgba(0, 255, 128, 0.2)' }}
                        >
                            <div style={{ background: 'rgba(0, 255, 128, 0.1)', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #00ff80' }}>
                                <Zap size={28} color="#00ff80" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '4px' }}>LIVE SCORE</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Create Matches & Manage Scores</p>
                            </div>
                        </motion.div>

                        {/* NEW: V3 Auction Console Box */}
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -5 }}
                            onClick={() => router.push('/admin/auction')}
                            className="glass"
                            style={{
                                padding: '25px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, transparent 100%)',
                                border: '2px solid var(--primary)',
                                boxShadow: '0 0 30px rgba(255, 215, 0, 0.2)'
                            }}
                        >
                            <div style={{ background: 'var(--primary)', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Hammer size={28} color="#000" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 950, marginBottom: '4px' }}>AUCTION CONSOLE</h3>
                                <p style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 800 }}>V3 Real-Time Bidding Panel</p>
                            </div>
                        </motion.div>
                    </div>

                    <div className="admin-grid">
                        <div className="glass" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Users size={18} /> Player Pool ({players.length})
                                </h2>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={clearPool}
                                        style={{
                                            background: 'rgba(255, 75, 75, 0.1)',
                                            color: '#ff4b4b',
                                            border: '1px solid rgba(255, 75, 75, 0.3)',
                                            padding: '6px 15px',
                                            borderRadius: '8px',
                                            fontSize: '0.7rem',
                                            fontWeight: 900,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        CLEAR ALL PLAYERS
                                    </button>
                                </div>
                            </div>
                            <div className="scrollable-table" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={thStyle}>PHOTO</th>
                                            <th style={thStyle}>FULL NAME</th>
                                            <th style={thStyle}>ક્રિકેટ માં આપની આવડત કઈ ?</th>
                                            <th style={thStyle}>KC3 (2025) REGISTERED?</th>
                                            <th style={thStyle}>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {players.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                    <Users size={32} style={{ opacity: 0.2, marginBottom: '10px' }} />
                                                    <div style={{ fontWeight: 700 }}>NO PLAYERS IN POOL</div>
                                                    <div style={{ fontSize: '0.75rem', marginTop: '5px' }}>Push some players from Registration Control.</div>
                                                </td>
                                            </tr>
                                        ) : players.map((p) => (
                                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', opacity: p.auction_status === 'sold' ? 0.6 : 1 }}>
                                                <td style={tdStyle}>
                                                    <motion.div
                                                        whileHover={{ scale: 3.5, zIndex: 10, position: 'relative', boxShadow: '0 0 30px rgba(0, 255, 128, 0.5)' }}
                                                        transition={{ type: 'spring', stiffness: 300 }}
                                                        style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#222', overflow: 'hidden', cursor: 'zoom-in' }}
                                                    >
                                                        <img
                                                            src={fixPhotoUrl(p.photo_url)}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            alt=""
                                                            referrerPolicy="no-referrer"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`;
                                                            }}
                                                        />
                                                    </motion.div>
                                                </td>
                                                <td style={tdStyle}><div style={{ fontWeight: 800, fontSize: '1rem' }}>{p.first_name} {p.last_name}</div></td>
                                                <td style={tdStyle}>{p.cricket_skill || 'N/A'}</td>
                                                <td style={tdStyle}>{p.was_present_kc3 || 'N/A'}</td>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        {p.auction_status === 'sold' && (
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#00ff80', padding: '8px 15px' }}>SOLD</div>
                                                        )}
                                                        {p.auction_status === 'active' && (
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', padding: '8px 15px', background: 'rgba(255,215,0,0.1)', borderRadius: '8px', border: '1px solid var(--primary)', animation: 'pulse 1.5s infinite' }}>LIVE</div>
                                                        )}
                                                        {p.auction_status === 'pending' && (
                                                            <button onClick={() => controlAuction('start', p.id)} className="btn-primary" style={{ padding: '8px 15px', fontSize: '0.75rem', fontWeight: 900, borderRadius: '8px' }}>START AUCTION</button>
                                                        )}
                                                        {p.auction_status === 'unsold' && (
                                                            <button onClick={() => controlAuction('start', p.id)} className="btn-secondary" style={{ padding: '8px 15px', fontSize: '0.75rem', fontWeight: 900, borderRadius: '8px', borderColor: '#ff4b4b', color: '#ff4b4b' }}>RE-AUCTION</button>
                                                        )}
                                                        <button onClick={async () => {
                                                            if (confirm('Delete player?')) {
                                                                const res = await fetch(`/api/admin/delete-player?id=${p.id}`, { method: 'DELETE' });
                                                                if (res.ok) fetchData();
                                                            }
                                                        }} style={{ color: '#ff4b4b', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="glass" style={{
                                padding: '25px',
                                border: auctionState?.status === 'active' ? '2px solid var(--primary)' : '1px solid var(--border)',
                            }}>
                                <h2 style={{ marginBottom: '20px', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Gavel size={20} color="var(--primary)" /> OFFICIAL CONSOLE
                                </h2>

                                {auctionState && (auctionState.status === 'BIDDING' || auctionState.status === 'active') ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '15px', textAlign: 'center', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                                                <div style={{ width: '80px', height: '80px', borderRadius: '20px', overflow: 'hidden', border: '2px solid var(--primary)', background: '#111' }}>
                                                    <img
                                                        src={fixPhotoUrl(currentPlayer?.photo_url)}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        alt=""
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPlayer?.first_name}`;
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '1px' }}>CURRENT FLOOR</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 900, margin: '5px 0' }}>{currentPlayer?.first_name} {currentPlayer?.last_name}</div>
                                            <div style={{ fontSize: '2.4rem', fontWeight: 950, color: 'var(--primary)', margin: '10px 0' }}>
                                                {auctionState.current_highest_bid} P
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <button onClick={() => controlAuction(auctionState.status === 'paused' ? 'resume' : 'pause')} className="btn-secondary" style={{ height: '45px', fontSize: '0.8rem' }}>
                                                {auctionState.status === 'paused' ? 'RESUME AUCTION' : 'PAUSE AUCTION'}
                                            </button>
                                            <button onClick={() => controlAuction('reset')} className="btn-secondary" style={{ height: '45px', fontSize: '0.8rem', borderColor: '#ff4b4b', color: '#ff4b4b' }}>END AUCTION</button>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <button onClick={sellPlayer} disabled={!auctionState.highest_bid_team_id} className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '1rem', fontWeight: 900 }}>MARK AS SOLD</button>
                                            <button onClick={() => controlAuction('unsold', auctionState.current_player_id)} className="btn-secondary" style={{ width: '100%', fontSize: '0.85rem' }}>MARK AS UNSOLD</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 20px' }}>
                                        <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '25px' }}>CONSOLE IDLE</p>
                                        <button
                                            onClick={drawRandom}
                                            className="btn-primary"
                                            style={{ width: '100%', padding: '20px', borderRadius: '15px', fontWeight: 900, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
                                        >
                                            <Shuffle size={24} /> NEXT PLAYER
                                        </button>
                                        <p style={{ fontSize: '0.7rem', marginTop: '15px', opacity: 0.5 }}>Pick a random player from the pool.</p>
                                    </div>
                                )}
                            </div>

                            <div className="glass" style={{ padding: '25px' }}>
                                <h2 style={{ marginBottom: '15px', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Shield size={18} color="var(--primary)" /> FRANCHISES
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {teams.map(t => (
                                        <div key={t.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.85rem' }}>
                                                <span style={{ fontWeight: 800 }}>{t.name}</span>
                                                <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{t.remaining_budget} P</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MAINTENANCE DANGER ZONE */}
                    <div style={{ marginTop: '80px', opacity: 0.4, transition: 'opacity 0.3s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}>
                        <div style={{ background: 'rgba(255, 75, 75, 0.05)', border: '1px solid rgba(255, 75, 75, 0.2)', padding: '30px', borderRadius: '25px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 900, color: '#ff4b4b', letterSpacing: '1px', marginBottom: '5px' }}>MAINTENANCE DANGER ZONE</h3>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Advanced synchronization tools for correcting data inconsistencies.</p>
                                </div>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <button
                                        onClick={auditBudgets}
                                        style={{
                                            background: 'rgba(0, 255, 128, 0.1)',
                                            color: '#00ff80',
                                            border: '1px solid rgba(0, 255, 128, 0.3)',
                                            padding: '10px 20px',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: 900,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        RE-CALCULATE BUDGETS
                                    </button>
                                    <button
                                        onClick={resetPurses}
                                        style={{
                                            background: 'rgba(255, 215, 0, 0.1)',
                                            color: 'var(--primary)',
                                            border: '1px solid rgba(255, 215, 0, 0.3)',
                                            padding: '10px 20px',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: 900,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        RESET ALL PURSES
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                </AnimatePresence>
            </main>
            <style jsx>{`
                .admin-grid { display: grid; grid-template-columns: 1fr 400px; gap: 25px; }
                @media (max-width: 1100px) { .admin-grid { grid-template-columns: 1fr; } }
            `}</style>
        </>
    );
}