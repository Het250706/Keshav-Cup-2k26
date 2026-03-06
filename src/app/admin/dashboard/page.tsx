'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Trash2, X, Gavel, Users, UserPlus, Shield, LogOut, Zap, Shuffle, FileText, Download, Link as LinkIcon, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import RoleGuard from '@/components/RoleGuard';
import { exportToPDF, exportToCSV } from '@/lib/exportUtils';
import RegistrationForm from '@/components/RegistrationForm';

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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sheetSyncing, setSheetSyncing] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: p } = await supabase.from('players').select('*').order('created_at', { ascending: false });
                const { data: s } = await supabase.from('auction_state').select('*').single();
                const { data: t } = await supabase.from('teams').select('*').order('name');

                if (p) setPlayers(p);
                if (s) setAuctionState(s);
                if (t) setTeams(t);
            } catch (err) {
                console.error('FetchData Error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        const stateSub = supabase.channel('admin_sync')
            .on('postgres_changes' as any, { event: '*', table: 'auction_state', schema: 'public' }, () => fetchData())
            .on('postgres_changes' as any, { event: '*', table: 'players', schema: 'public' }, () => fetchData())
            .on('postgres_changes' as any, { event: '*', table: 'teams', schema: 'public' }, () => fetchData())
            .on('postgres_changes' as any, { event: '*', table: 'bids', schema: 'public' }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
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
        } catch (err: any) {
            console.error('Auction Control Error:', err);
            alert('Action Failed: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const sellPlayer = async () => {
        if (!auctionState?.current_player_id || !auctionState?.last_bid_team_id) {
            alert("No active player or no bids placed yet.");
            return;
        }

        try {
            const res = await fetch('/api/auction/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id: auctionState.current_player_id,
                    team_id: auctionState.last_bid_team_id,
                    price: auctionState.current_highest_bid
                })
            });

            if (!res.ok) throw new Error('Failed to assign player');
            alert('Player assigned successfully!');
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const drawRandom = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auction/draw-random', { method: 'POST' });
            if (res.ok) {
                window.location.reload();
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

    const syncSheet = async () => {
        setSheetSyncing(true);
        try {
            const res = await fetch('/api/admin/sync-sheet', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                alert(`Synced ${data.count} new players from registrations!`);
                window.location.reload();
            } else {
                alert('Sync failed: ' + data.error);
            }
        } catch (err) {
            alert('Sync connection error');
        } finally {
            setSheetSyncing(false);
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
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button onClick={() => exportToCSV(players)} className="btn-secondary" style={{ padding: '8px 20px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                                <FileSpreadsheet size={16} /> <span>EXPORT ALL (CSV)</span>
                            </button>
                            <button onClick={() => setIsModalOpen(true)} className="btn-primary" style={{ padding: '10px 25px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '12px', boxShadow: '0 0 15px rgba(255,215,0,0.3)' }}>
                                <UserPlus size={18} /> <span style={{ fontWeight: 900 }}>REGISTER PLAYER</span>
                            </button>
                        </div>
                    </div>

                    <div className="admin-grid">
                        <div className="glass" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Users size={18} /> Player Pool ({players.length})
                                </h2>
                            </div>
                            <div className="scrollable-table" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={thStyle}>PLAYER</th>
                                            <th style={thStyle}>ROLE</th>
                                            <th style={thStyle}>AGE / CITY</th>
                                            <th style={thStyle}>STYLE</th>
                                            <th style={thStyle}>BASE PRICE</th>
                                            <th style={thStyle}>STATUS</th>
                                            <th style={thStyle}>ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {players.map((p) => (
                                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', opacity: p.auction_status === 'sold' ? 0.6 : 1 }}>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#222', overflow: 'hidden' }}>
                                                            <img src={p.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{p.first_name} {p.last_name}</div>
                                                            <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 800 }}>{p.category}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={tdStyle}>{p.role}</td>
                                                <td style={tdStyle}>
                                                    <div style={{ fontWeight: 700 }}>{p.age || 20} Yrs</div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{p.city?.toUpperCase() || 'LOCAL'}</div>
                                                </td>
                                                <td style={tdStyle}>{p.batting_style?.replace('_', ' ') || 'Right Handed'}</td>
                                                <td style={tdStyle}>₹ {(p.base_price / 10000000).toFixed(2)} Cr</td>
                                                <td style={tdStyle}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                                                        {p.auction_status === 'sold' ? <span style={{ color: '#00ff80' }}>SOLD</span> :
                                                            p.auction_status === 'unsold' ? <span style={{ color: '#ff4b4b' }}>UNSOLD</span> :
                                                                <span style={{ color: 'var(--text-muted)' }}>PENDING</span>}
                                                    </div>
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {(p.auction_status === 'pending' || !p.auction_status) && (
                                                            <button onClick={() => controlAuction('start', p.id)} className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.65rem' }}>START</button>
                                                        )}
                                                        <button onClick={async () => {
                                                            if (confirm('Delete player?')) {
                                                                const res = await fetch(`/api/admin/delete-player?id=${p.id}`, { method: 'DELETE' });
                                                                if (res.ok) window.location.reload();
                                                            }
                                                        }} style={{ color: '#ff4b4b' }}><Trash2 size={16} /></button>
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

                                {auctionState && auctionState.status !== 'idle' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '15px', textAlign: 'center', border: '1px solid var(--border)' }}>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '1px' }}>CURRENT FLOOR</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 900, margin: '5px 0' }}>{currentPlayer?.first_name} {currentPlayer?.last_name}</div>
                                            <div style={{ fontSize: '2.4rem', fontWeight: 950, color: 'var(--primary)', margin: '10px 0' }}>
                                                ₹ {((auctionState.current_highest_bid || 50000000) / 10000000).toFixed(2)} Cr
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <button onClick={() => controlAuction(auctionState.status === 'paused' ? 'resume' : 'pause')} className="btn-secondary" style={{ height: '45px', fontSize: '0.8rem' }}>
                                                {auctionState.status === 'paused' ? 'RESUME' : 'PAUSE'}
                                            </button>
                                            <button onClick={() => controlAuction('reset')} className="btn-secondary" style={{ height: '45px', fontSize: '0.8rem' }}>RESET</button>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <button onClick={sellPlayer} disabled={!auctionState.last_bid_team_id} className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '1rem', fontWeight: 900 }}>MARK AS SOLD</button>
                                            <button onClick={() => controlAuction('unsold', auctionState.current_player_id)} className="btn-secondary" style={{ width: '100%', borderColor: '#ff4b4b', color: '#ff4b4b', fontSize: '0.85rem' }}>UNSOLD</button>
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
                                            <Shuffle size={24} /> RANDOM DRAW
                                        </button>
                                        <p style={{ fontSize: '0.7rem', marginTop: '15px', opacity: 0.5 }}>Click to pick a random player from the pending pool and start the auction.</p>
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
                                                <span style={{ color: 'var(--primary)', fontWeight: 800 }}>₹ {(t.remaining_budget / 10000000).toFixed(1)} Cr</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {isModalOpen && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(15px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
                            <motion.div
                                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="glass"
                                style={{
                                    width: '90vw',
                                    height: '90vh',
                                    padding: '0',
                                    background: '#000',
                                    borderRadius: '32px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    border: '1px solid rgba(255,215,0,0.2)'
                                }}
                            >
                                <div style={{
                                    padding: '20px 30px',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(255,215,0,0.05)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FileText size={20} color="#000" />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.5px' }}>ON-SPOT REGISTRATION</h3>
                                            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>NATIVE SYSTEM FORM</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsModalOpen(false)} style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: 'none',
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: '#fff'
                                    }}><X size={24} /></button>
                                </div>

                                <div style={{ height: 'calc(100% - 81px)', background: '#000', overflowY: 'auto' }}>
                                    <RegistrationForm />
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </main>
            <style jsx>{`
                .admin-grid { display: grid; grid-template-columns: 1fr 400px; gap: 25px; }
                @media (max-width: 1100px) { .admin-grid { grid-template-columns: 1fr; } }
            `}</style>
        </>
    );
}