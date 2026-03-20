'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Trash2, X, Gavel, Users, UserPlus, Shield, LogOut, Zap, Shuffle, Download, Link as LinkIcon, ExternalLink, Settings, LayoutGrid, Hammer, RotateCcw, PieChart, History as HistoryIcon } from 'lucide-react';
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
    const thStyle: React.CSSProperties = { padding: '10px', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center' };
    const tdStyle: React.CSSProperties = { padding: '10px', fontSize: '0.8rem', textAlign: 'center', color: '#ddd' };

    const [players, setPlayers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [sheetSyncing, setSheetSyncing] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string>('All');
    const [showSlotManager, setShowSlotManager] = useState(false);
    const [newSlotName, setNewSlotName] = useState('');
    const [reAuctionLoading, setReAuctionLoading] = useState(false);
    const router = useRouter();

    const [registrationsCount, setRegistrationsCount] = useState(0);

    const fetchData = async () => {
        try {
            const [playersRes, stateRes, teamsRes, regRes] = await Promise.all([
                supabase.from('players').select('*').order('created_at', { ascending: false }),
                supabase.from('auction_state').select('*').single(),
                supabase.from('teams').select('*').order('name'),
                supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('is_pushed', false)
            ]);

            if (playersRes.data) setPlayers(playersRes.data);
            if (stateRes.data) setAuctionState(stateRes.data);
            if (teamsRes.data) setTeams(teamsRes.data);
            if (regRes.count !== null) setRegistrationsCount(regRes.count);

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
            .on('postgres_changes' as any, { event: '*', table: 'auction_state', schema: 'public' }, () => { if (isMounted) fetchData(); })
            .on('postgres_changes' as any, { event: '*', table: 'players', schema: 'public' }, () => { if (isMounted) fetchData(); })
            .on('postgres_changes' as any, { event: '*', table: 'teams', schema: 'public' }, () => { if (isMounted) fetchData(); })
            .on('postgres_changes' as any, { event: '*', table: 'bids', schema: 'public' }, () => { if (isMounted) fetchData(); })
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
        // Filter players based on selected slot
        const pool = selectedSlot === 'All'
            ? players.filter(p => p.auction_status === 'pending')
            : players.filter(p => p.auction_status === 'pending' && p.category === selectedSlot);

        if (pool.length === 0) {
            alert(selectedSlot === 'All' ? 'Auction Pool Empty!' : `Slot "${selectedSlot}" Completed. Move to Next Slot.`);
            return;
        }

        setLoading(true);
        try {
            // Pick a random player from the filtered pool locally and start their auction
            const randomPlayer = pool[Math.floor(Math.random() * pool.length)];
            await controlAuction('start', randomPlayer.id);
        } catch (err) {
            alert('Error drawing player');
        } finally {
            setLoading(false);
        }
    };

    const updatePlayerSlot = async (playerId: string, category: string) => {
        let finalCategory = category;
        if (category === '+ New Slot') {
            const name = prompt('Enter new slot name:');
            if (!name) return;
            finalCategory = name;
        }
        try {
            const res = await fetch('/api/players/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', player: { id: playerId, category: finalCategory } })
            });
            if (res.ok) fetchData();
        } catch (err) {
            alert('Error updating slot');
        }
    };

    const deleteSlot = async (slotName: string) => {
        if (slotName === 'Unassigned') return;
        if (!confirm(`🚨 Delete Slot "${slotName}"?\n\nThis will move all players in this slot back to "Unassigned".\nNo players will be deleted, only their category will be removed.`)) return;

        setSyncing(true);
        try {
            const playersInSlot = players.filter(p => p.category === slotName);

            // Update players in sequence (using manage API which uses admin key)
            await Promise.all(playersInSlot.map(p =>
                fetch('/api/players/manage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update', player: { id: p.id, category: 'Unassigned' } })
                })
            ));

            if (selectedSlot === slotName) setSelectedSlot('All');
            alert(`✅ Slot "${slotName}" removed successfully.`);
            fetchData();
        } catch (err) {
            console.error('Delete Slot Error:', err);
            alert('Failed to delete slot.');
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

    const migratePhotos = async () => {
        if (!confirm('Migrate all Google Drive photos to Supabase Storage? This will make image loading much faster and more stable.')) return;

        setSyncing(true);
        try {
            const res = await fetch('/api/admin/migrate-bulk-photos', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(`✅ Migration Complete!\n\nMigrated: ${data.migrated} photos\nSkipped: ${data.skipped} (already migrated or empty)`);
                fetchData();
            } else {
                throw new Error(data.error || 'Migration failed');
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
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Players in Pool: <b style={{ color: '#fff' }}>{players.length}</b></p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>•</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pending: <b style={{ color: 'var(--primary)' }}>{registrationsCount}</b></p>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '40px' }}>


                        {/* Registration Control Box */}
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -5 }}
                            onClick={() => router.push('/admin/registrations')}
                            className="glass"
                            style={{ padding: '25px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                                <UserPlus size={28} color="var(--primary)" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '4px' }}>REGISTRATIONS</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{registrationsCount} Players Waiting</p>
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
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Manage Matches</p>
                            </div>
                        </motion.div>

                        {/* Slot Management Box */}
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -5 }}
                            onClick={() => setShowSlotManager(!showSlotManager)}
                            className="glass"
                            style={{
                                padding: '25px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                                background: showSlotManager ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.05)',
                                border: showSlotManager ? '2px solid #38bdf8' : '1px solid rgba(56, 189, 248, 0.2)'
                            }}
                        >
                            <div style={{ background: '#38bdf8', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Settings size={28} color="#000" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '4px' }}>SLOTS</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Configure Categories</p>
                            </div>
                        </motion.div>

                        {/* Auction Console Box */}
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
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 950, marginBottom: '4px' }}>LIVE AUCTION</h3>
                                <p style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 800 }}>V3 Bidding Panel</p>
                            </div>
                        </motion.div>

                        {/* Big Screen Display Box */}
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -5 }}
                            onClick={() => window.open('/auction/display', '_blank')}
                            className="glass"
                            style={{
                                padding: '25px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                                background: 'rgba(0, 210, 255, 0.05)',
                                border: '1px solid #00d2ff',
                                boxShadow: '0 0 30px rgba(0, 210, 255, 0.1)'
                            }}
                        >
                            <div style={{ background: '#00d2ff', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ExternalLink size={28} color="#000" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 950, marginBottom: '4px' }}>BIG SCREEN</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>Broadcast (Keshav Cup Style)</p>
                            </div>
                        </motion.div>
                    </div>

                    {/* SLOT MANAGEMENT DRAWER */}
                    <AnimatePresence>
                        {showSlotManager && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden', marginBottom: '30px' }}
                            >
                                <div className="glass" style={{ padding: '30px', border: '1px solid #38bdf8' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <LayoutGrid size={20} color="#38bdf8" /> CONFIGURE AUCTION SLOTS
                                        </h2>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input
                                                type="text"
                                                placeholder="New Slot Name..."
                                                value={newSlotName}
                                                onChange={(e) => setNewSlotName(e.target.value)}
                                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 15px', borderRadius: '8px', color: '#fff', fontSize: '0.8rem' }}
                                            />
                                            <button
                                                onClick={() => {
                                                    if (!newSlotName) return;
                                                    setNewSlotName('');
                                                    alert(`To add slot "${newSlotName}", assign a player to it using the pool table actions below.`);
                                                }}
                                                className="btn-secondary"
                                                style={{ fontSize: '0.7rem', padding: '0 15px' }}
                                            >+ CREATE SLOT</button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                        {['All', ...Array.from(new Set(players.map(p => p.category || 'Unassigned')))].map(slot => (
                                            <div key={slot} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <button
                                                    onClick={() => setSelectedSlot(slot)}
                                                    style={{
                                                        padding: '10px 20px',
                                                        paddingRight: (slot !== 'All' && slot !== 'Unassigned') ? '45px' : '20px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 800,
                                                        background: selectedSlot === slot ? '#38bdf8' : 'rgba(255,255,255,0.05)',
                                                        color: selectedSlot === slot ? '#000' : '#fff',
                                                        border: selectedSlot === slot ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                                                        transition: 'all 0.2s',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {slot === 'All' ? '🌐 ALL PLAYERS' : `📦 SLOT: ${slot}`}
                                                    <span style={{ marginLeft: '8px', opacity: 0.5 }}>
                                                        ({players.filter(p => (slot === 'All' || p.category === slot) && p.auction_status === 'pending').length})
                                                    </span>
                                                </button>
                                                {slot !== 'All' && slot !== 'Unassigned' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteSlot(slot);
                                                        }}
                                                        style={{
                                                            position: 'absolute',
                                                            right: '10px',
                                                            background: 'rgba(255, 75, 75, 0.1)',
                                                            border: 'none',
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '6px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#ff4b4b',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{ marginTop: '15px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>* Selecting a slot will restrict the "NEXT PLAYER" button to only players in that category.</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="admin-grid">
                        <div className="glass" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Shield size={18} color="var(--primary)" /> PLAYER POOL
                                </h2>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    {selectedSlot !== 'All' && (
                                        <div style={{ background: '#38bdf8', color: '#000', padding: '4px 12px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 950, textTransform: 'uppercase' }}>
                                            ACTIVE SLOT: {selectedSlot}
                                        </div>
                                    )}
                                    <button
                                        onClick={async () => {
                                            if (!confirm('🔄 RESTORE ALL PLAYERS from Google Sheet? This will re-import all registered players into the pool.')) return;
                                            setSyncing(true);
                                            try {
                                                const res = await fetch('/api/admin/bulk-push', { method: 'POST' });
                                                const data = await res.json();
                                                if (data.success) {
                                                    alert(`✅ Restored ${data.pushed} players!\nSkipped: ${data.skipped} (already exist)\n\n${data.message}`);
                                                    fetchData();
                                                } else {
                                                    throw new Error(data.error || 'Restore failed');
                                                }
                                            } catch (err: any) {
                                                alert('Error: ' + err.message);
                                            } finally {
                                                setSyncing(false);
                                            }
                                        }}
                                        disabled={syncing}
                                        style={{
                                            background: 'rgba(0, 255, 128, 0.1)',
                                            color: '#00ff80',
                                            border: '1px solid rgba(0, 255, 128, 0.3)',
                                            padding: '6px 15px',
                                            borderRadius: '8px',
                                            fontSize: '0.7rem',
                                            fontWeight: 900,
                                            cursor: syncing ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {syncing ? 'RESTORING...' : '🔄 RESTORE ALL PLAYERS'}
                                    </button>
                                </div>
                            </div>
                            <div className="scrollable-table" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ ...thStyle, width: '70px' }}>PHOTO</th>
                                            <th style={{ ...thStyle, width: '150px', textAlign: 'left' }}>FULL NAME</th>
                                            <th style={{ ...thStyle, width: '110px' }}>CRICKET SKILL</th>
                                            <th style={{ ...thStyle, width: '100px' }}>KESHAV CUP </th>
                                            <th style={{ ...thStyle, width: '120px' }}>SLOTS</th>
                                            <th style={{ ...thStyle, width: '140px' }}>AUCTION</th>
                                            <th style={{ ...thStyle, width: '60px' }}>DELETE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {players.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                    <Users size={32} style={{ opacity: 0.2, marginBottom: '10px' }} />
                                                    <div style={{ fontWeight: 700 }}>NO PLAYERS IN POOL</div>
                                                    <div style={{ fontSize: '0.75rem', marginTop: '5px' }}>Push some players from Registration Control.</div>
                                                </td>
                                            </tr>
                                        ) : players.map((p) => (
                                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                                                <td style={tdStyle}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#222', overflow: 'hidden', margin: '0 auto', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <img
                                                            src={fixPhotoUrl(p.photo_url || p.photo, p.first_name)}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            alt=""
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`;
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'left' }}>
                                                    <div style={{ fontWeight: 800, color: '#fff' }}>{p.first_name} {p.last_name}</div>
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ fontWeight: 700 }}>{p.cricket_skill || p.role}</div>
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ fontWeight: 900, color: (p.was_present_kc3 === 'હા' || p.was_present_kc3 === 'Yes') ? '#00ff80' : '#ff4b4b' }}>
                                                        {(p.was_present_kc3 === 'હા' || p.was_present_kc3 === 'Yes') ? 'YES' : 'NO'}
                                                    </div>
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ fontWeight: 800, color: 'var(--primary)' }}>{p.category || 'Unassigned'}</div>
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                                                        {p.auction_status === 'sold' && (
                                                            <div style={{ background: 'rgba(0, 255, 128, 0.1)', color: '#00ff80', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 950 }}>SOLD</div>
                                                        )}
                                                        {p.auction_status === 'active' && (
                                                            <div style={{ background: 'rgba(255, 215, 0, 0.1)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 950, border: '1px solid var(--primary)' }}>LIVE</div>
                                                        )}
                                                        {p.auction_status === 'unsold' && (
                                                            <div style={{ background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 950 }}>UNSOLD</div>
                                                        )}
                                                        {p.auction_status === 'pending' && (
                                                            <button
                                                                onClick={() => controlAuction('start', p.id)}
                                                                style={{
                                                                    padding: '8px 16px',
                                                                    borderRadius: '8px',
                                                                    background: 'rgba(255, 215, 0, 0.1)',
                                                                    border: '1px solid rgba(255, 215, 0, 0.3)',
                                                                    color: 'var(--primary)',
                                                                    fontWeight: 900,
                                                                    fontSize: '0.65rem',
                                                                    cursor: 'pointer',
                                                                    textTransform: 'uppercase'
                                                                }}
                                                                className="push-btn"
                                                            >
                                                                START AUCTION
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={tdStyle}>
                                                    <button onClick={async () => {
                                                        if (confirm('Delete player?')) {
                                                            const res = await fetch(`/api/admin/delete-player?id=${p.id}`, { method: 'DELETE' });
                                                            if (res.ok) fetchData();
                                                        }
                                                    }} style={{ color: '#ff4b4b', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}>
                                                        <Trash2 size={16} />
                                                    </button>
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Gavel size={20} color="var(--primary)" /> OFFICIAL CONSOLE
                                    </h2>
                                </div>

                                {auctionState && currentPlayer && (auctionState.status === 'BIDDING' || auctionState.status === 'active') ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '15px', textAlign: 'center', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                                                <div style={{ width: '80px', height: '80px', borderRadius: '20px', overflow: 'hidden', border: '2px solid var(--primary)', background: '#111' }}>
                                                    <img
                                                        src={fixPhotoUrl(currentPlayer?.photo_url, currentPlayer?.first_name)}
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
                                        {selectedSlot !== 'All' && players.filter(p => p.auction_status === 'pending' && p.category === selectedSlot).length === 0 ? (
                                            <div style={{ marginBottom: '20px' }}>
                                                <div style={{ color: '#38bdf8', fontSize: '1.2rem', fontWeight: 950, marginBottom: '10px' }}>SLOT COMPLETED ✓</div>
                                                <p style={{ fontSize: '0.8rem' }}>All players in <b>{selectedSlot}</b> have been auctioned.</p>
                                                <button
                                                    onClick={() => setShowSlotManager(true)}
                                                    className="btn-secondary"
                                                    style={{ marginTop: '20px', borderColor: '#38bdf8', color: '#38bdf8' }}
                                                >MOVE TO NEXT SLOT</button>
                                            </div>
                                        ) : (
                                            <>
                                                <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '25px' }}>
                                                    CONSOLE IDLE {selectedSlot !== 'All' ? `(${selectedSlot})` : ''}
                                                </p>
                                                <button
                                                    onClick={drawRandom}
                                                    className="btn-primary"
                                                    style={{ width: '100%', padding: '20px', borderRadius: '15px', fontWeight: 900, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
                                                >
                                                    <Shuffle size={24} /> NEXT PLAYER
                                                </button>
                                                <p style={{ fontSize: '0.7rem', marginTop: '15px', opacity: 0.5 }}>
                                                    Pick a random {selectedSlot !== 'All' ? <b>{selectedSlot}</b> : 'any'} player.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* RE-AUCTION POOL PANEL */}
                            <div className="glass" style={{ padding: '25px', borderColor: '#ff4b4b' }}>
                                <h2 style={{ marginBottom: '15px', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', color: '#ff4b4b' }}>
                                    <RotateCcw size={18} /> RE-AUCTION POOL
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                                    {players.filter(p => p.auction_status === 'unsold').length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '20px', fontSize: '0.75rem', opacity: 0.5 }}>No Unsold Players</div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={async () => {
                                                    const pool = players.filter(p => p.auction_status === 'unsold');
                                                    if (pool.length > 0) {
                                                        setReAuctionLoading(true);
                                                        await controlAuction('start', pool[0].id);
                                                        setReAuctionLoading(false);
                                                    }
                                                }}
                                                className="btn-secondary"
                                                style={{ marginBottom: '10px', width: '100%', borderColor: '#ff4b4b', color: '#ff4b4b', fontWeight: 950 }}
                                            >
                                                START RE-AUCTION ({players.filter(p => p.auction_status === 'unsold').length} LEFT)
                                            </button>
                                            {players.filter(p => p.auction_status === 'unsold').map(p => (
                                                <div key={p.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,75,75,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <img src={fixPhotoUrl(p.photo_url, p.first_name)} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{p.first_name} {p.last_name}</span>
                                                    </div>
                                                    <button onClick={() => controlAuction('start', p.id)} style={{ padding: '4px 10px', fontSize: '0.65rem', background: '#ff4b4b', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 900 }}>RE-RUN</button>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
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
                                        onClick={migratePhotos}
                                        disabled={syncing}
                                        style={{
                                            background: 'rgba(56, 189, 248, 0.1)',
                                            color: '#38bdf8',
                                            border: '1px solid rgba(56, 189, 248, 0.3)',
                                            padding: '10px 20px',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: 900,
                                            cursor: syncing ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <Download size={14} /> {syncing ? 'PROCESSING...' : 'STABILIZE PHOTOS'}
                                    </button>
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