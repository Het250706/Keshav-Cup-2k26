
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Send, CheckCircle, Clock, Search, RefreshCw, UserCheck, Trash2, Shield } from 'lucide-react';
import { fixPhotoUrl } from '@/lib/utils';
import RoleGuard from '@/components/RoleGuard';
import { motion, AnimatePresence } from 'framer-motion';

export default function RegistrationControl() {
    return (
        <RoleGuard allowedRole="admin">
            <RegistrationControlContent />
        </RoleGuard>
    );
}

function RegistrationControlContent() {
    const [sheetPlayers, setSheetPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pushingId, setPushingId] = useState<string | null>(null);
    const [filterPushed, setFilterPushed] = useState(false);

    const fetchRegistrations = async () => {
        setLoading(true);
        try {
            const [sheetRes, dbRes] = await Promise.all([
                fetch('/api/admin/sheet-registrations').then(res => res.json()),
                supabase.from('players').select('id, first_name, last_name, cricket_skill')
            ]);

            if (sheetRes.players) {
                const dbPlayers = (dbRes.data || []) as any[];
                const markedPlayers = sheetRes.players.map((sp: any) => {
                    const spFullName = sp.fullName?.toLowerCase().trim();

                    // Match by full name
                    const match = dbPlayers.find((dp: any) =>
                        `${dp.first_name} ${dp.last_name}`.toLowerCase().trim() === spFullName
                    );

                    if (match) {
                        return { ...sp, pushed: true, dbId: match.id };
                    }
                    return sp;
                });
                setSheetPlayers(markedPlayers);
            } else if (sheetRes.error) {
                alert(`Error syncing from Sheet: ${sheetRes.error}\nDetails: ${sheetRes.details || 'None'}`);
            }
        } catch (err: any) {
            console.error('Fetch error:', err);
            alert('Failed to connect to registration system: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegistrations();
    }, []);

    const pushPlayer = async (p: any) => {
        setPushingId(p.id);
        try {
            const nameParts = p.fullName?.split(' ') || ['Unknown', 'Player'];
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || 'Player';

            // Mapping following the exactly requested schema
            const playerData: any = {
                first_name: firstName,
                last_name: lastName,
                cricket_skill: p.skill || 'N/A',
                was_present_kc3: p.participation || 'No',
                photo_url: p.photo || '',
                base_price: 20000000,
                category: 'Silver',
                role: p.skill || 'All-rounder',
                auction_status: 'pending'
            };

            const res = await fetch('/api/admin/push-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player: playerData })
            });

            const result = await res.json();

            if (res.ok && result.success) {
                alert('✅ Player pushed to pool successfully!');
                setSheetPlayers(prev => prev.map(item => item.id === p.id ? { ...item, pushed: true, dbId: result.data.id } : item));
            } else {
                throw result;
            }
        } catch (err: any) {
            console.error('--- CRITICAL PUSH FAILURE ---', err);

            const msg = err?.error || err?.message || 'Unknown server error';
            const code = err?.code || 'API_ERR';
            const details = err?.details || '';
            const hint = err?.hint || '';

            alert(`❌ PUSH FAILED\n\n` +
                `Error: ${msg}\n` +
                `Code: ${code}\n` +
                (details ? `Details: ${details}\n` : '') +
                (hint ? `Hint: ${hint}\n` : '') +
                `\nIf you see 'column does not exist', please run the FIX_SCHEMA_WAS_PRESENT_KC3.sql script in your Supabase SQL Editor.`);
        } finally {
            setPushingId(null);
        }
    };

    const startAuction = async (p: any) => {
        if (!p.dbId) return;
        setPushingId(p.id); // Reusing pushingId for loading state
        try {
            const res = await fetch('/api/auction/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: p.dbId })
            });
            if (res.ok) {
                alert('Auction started LIVE!');
            } else {
                throw new Error('Failed to start auction');
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setPushingId(null);
        }
    };

    const deleteFromDb = async (p: any) => {
        if (!p.dbId) return;
        if (!confirm(`Are you sure you want to remove ${p.first_name || 'this player'} from the database? This will allow you to PUSH them again if needed.`)) return;

        setPushingId(p.id);
        try {
            const res = await fetch(`/api/admin/delete-player?id=${p.dbId}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Player removed from pool.');
                setSheetPlayers(prev => prev.map(item => item.id === p.id ? { ...item, pushed: false, dbId: undefined } : item));
            } else {
                const result = await res.json();
                throw new Error(result.error || 'Failed to delete');
            }
        } catch (err: any) {
            alert('Error deleting: ' + err.message);
        } finally {
            setPushingId(null);
        }
    };

    const deleteRegistration = (p: any) => {
        if (!confirm("Are you sure you want to delete this player registration?")) return;

        setSheetPlayers(prev => prev.filter(item => item.id !== p.id));
        alert("Player registration deleted successfully.");
    };

    return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
            <Navbar />
            <div style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ marginBottom: '30px' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Player Registration Control
                    </h1>
                </div>

                <div className="glass" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flex: 1 }}>
                            <Search size={18} color="var(--text-muted)" />
                            <input type="text" placeholder="Search Registrations..." style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', outline: 'none', width: '100%' }} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
                            <input type="checkbox" checked={filterPushed} onChange={(e) => setFilterPushed(e.target.checked)} />
                            HIDE PUSHED
                        </label>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                    <th style={thStyle}>Player Photo</th>
                                    <th style={thStyle}>Full Name</th>
                                    <th style={thStyle}>Cricket Skill</th>
                                    <th style={thStyle}>Keshav Cup Participation</th>
                                    <th style={thStyle}>Push Button</th>
                                    <th style={thStyle}>Delete Button</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && sheetPlayers.length === 0 ? (
                                    <tr><td colSpan={6} style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>Fetching responses from Google Sheet...</td></tr>
                                ) : (sheetPlayers.length === 0) ? (
                                    <tr><td colSpan={6} style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>No registrations found.</td></tr>
                                ) : sheetPlayers.filter(p => filterPushed ? !p.pushed : true).map((p) => {
                                    return (
                                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', background: p.pushed ? 'rgba(0, 255, 128, 0.05)' : 'transparent' }}>
                                            <td style={tdStyle}>
                                                <motion.div
                                                    whileHover={{ scale: 4.5, zIndex: 50, position: 'relative', boxShadow: '0 0 50px rgba(255, 215, 0, 0.8)' }}
                                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                                    style={{ width: '60px', height: '60px', borderRadius: '12px', background: '#1a1a1a', overflow: 'hidden', cursor: 'zoom-in', border: '2px solid rgba(255,255,255,0.1)' }}
                                                >
                                                    <img
                                                        src={fixPhotoUrl(p.photo)}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                        alt="Player Photo"
                                                        referrerPolicy="no-referrer"
                                                        title="Drive permissions check"
                                                    />
                                                </motion.div>
                                            </td>
                                            <td style={tdStyle}><div style={{ fontWeight: 800 }}>{p.fullName}</div></td>
                                            <td style={tdStyle}>{p.skill}</td>
                                            <td style={tdStyle}>{p.participation}</td>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    {p.pushed ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ff80', fontWeight: 800, fontSize: '0.8rem', background: 'rgba(0,255,128,0.1)', padding: '8px 15px', borderRadius: '10px', border: '1px solid rgba(0,255,128,0.2)' }}>
                                                            <CheckCircle size={16} /> PUSHED
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => pushPlayer(p)}
                                                            disabled={pushingId === p.id}
                                                            className="btn-primary"
                                                            style={{ padding: '8px 20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                        >
                                                            {pushingId === p.id ? 'PUSHING...' : 'PUSH'} <Send size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                <button
                                                    onClick={() => deleteRegistration(p)}
                                                    className="btn-primary"
                                                    style={{
                                                        padding: '8px 15px',
                                                        fontSize: '0.75rem',
                                                        background: '#ff4b4b',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        border: 'none',
                                                        fontWeight: 800
                                                    }}
                                                >
                                                    <Trash2 size={14} /> DELETE
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <style jsx>{`
                .rotate { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </main>
    );
}

const thStyle: React.CSSProperties = { padding: '20px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' };
const tdStyle: React.CSSProperties = { padding: '20px', fontSize: '0.9rem' };
