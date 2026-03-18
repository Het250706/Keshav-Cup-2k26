'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Search, Trash2, Camera, RefreshCw, Loader2, Upload } from 'lucide-react';
import RoleGuard from '@/components/RoleGuard';
import { motion, AnimatePresence } from 'framer-motion';
import { fixPhotoUrl } from '@/lib/utils';

export default function RegistrationControl() {
    return (
        <RoleGuard allowedRole="admin">
            <RegistrationControlContent />
        </RoleGuard>
    );
}

function RegistrationControlContent() {
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pushingId, setPushingId] = useState<string | null>(null);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [hidePushed, setHidePushed] = useState(true);
    const [allSlots, setAllSlots] = useState<string[]>([]);
    const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
    const [newSlotInput, setNewSlotInput] = useState('');

    // Photo Management State
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
    const [showModal, setShowModal] = useState(false);
    const [useCamera, setUseCamera] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchRegistrations = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('registrations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching registrations:', error);
        } else {
            setRegistrations(data || []);
        }
        setLoading(false);
    };


    const uploadPhoto = async (fileOrBlob: File | Blob) => {
        if (!selectedPlayer) return;
        setUploadingId(selectedPlayer.id);
        setShowModal(false);

        try {
            // 1. Create unique filename based on mobile
            const fileName = `${selectedPlayer.mobile || Date.now()}.jpg`;

            // 2. Upload to Storage (bucket: player-photos)
            const { error: uploadError } = await supabase.storage
                .from('player-photos')
                .upload(fileName, fileOrBlob, { upsert: true });

            if (uploadError) throw uploadError;

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('player-photos')
                .getPublicUrl(fileName);

            // 4. Update Registration Table
            const { error: regErr } = await supabase
                .from('registrations')
                .update({ photo: publicUrl })
                .eq('id', selectedPlayer.id);

            if (regErr) throw regErr;

            const nameParts = selectedPlayer.name?.split(' ') || ['Unknown', 'Player'];
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || 'Player';

            await supabase
                .from('players')
                .update({ photo_url: publicUrl })
                .eq('first_name', firstName)
                .eq('last_name', lastName);

            fetchRegistrations();
            alert("Photo updated successfully!");
        } catch (err: any) {
            console.error('Upload error:', err);
            alert("Failed to upload photo: " + (err.message || "Unknown error"));
        } finally {
            setUploadingId(null);
            setSelectedPlayer(null);
            stopCamera();
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setUseCamera(true);
        } catch (err) {
            alert("Camera access denied or not available");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setUseCamera(false);
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
            if (blob) uploadPhoto(blob);
        }, 'image/jpeg', 0.8);
    };


    const pushToPool = async (player: any) => {
        if (!confirm(`Push ${player.name} to the main player pool?`)) return;
        setPushingId(player.id);
        try {
            const res = await fetch('/api/admin/push-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player })
            });
            const result = await res.json();
            if (result.success) {
                // Update local state to mark as pushed
                setRegistrations(prev => prev.map(p =>
                    p.id === player.id ? { ...p, is_pushed: true } : p
                ));
                alert(`SUCCESS! ${player.name} moved to the Player Pool.`);
            } else {
                alert('Failed to push: ' + result.error);
            }
        } catch (err: any) {
            alert('Error pushing player: ' + err.message);
        } finally {
            setPushingId(null);
        }
    };


    const updateRegistrationSlot = async (id: string, newSlot: string) => {
        const { error } = await supabase.from('registrations').update({ occupation: newSlot }).eq('id', id);
        if (error) {
            alert('Failed to update slot: ' + error.message);
        } else {
            setRegistrations(prev => prev.map(p => p.id === id ? { ...p, occupation: newSlot } : p));
            // Add to local session slots if not "Unassigned"
            if (newSlot !== 'Unassigned') {
                setAllSlots(prev => prev.includes(newSlot) ? prev : [...prev, newSlot].sort());
            }
        }
    };

    const confirmNewSlot = async (id: string) => {
        const val = newSlotInput.trim();
        if (!val) {
            setEditingSlotId(null);
            return;
        }
        await updateRegistrationSlot(id, val);
        setEditingSlotId(null);
        setNewSlotInput('');
    };

    const deleteRegistration = async (id: string) => {
        if (!confirm('Are you sure you want to delete this registration?')) return;
        const { error } = await supabase.from('registrations').delete().eq('id', id);
        if (error) {
            alert('Delete failed: ' + error.message);
        } else {
            setRegistrations(prev => prev.filter(p => p.id !== id));
        }
    };

    useEffect(() => {
        fetchRegistrations();

        const channel = supabase
            .channel('registrations_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
                fetchRegistrations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filtered = registrations.filter(p => {
        const matchesSearch =
            p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.mobile?.includes(searchTerm);

        if (hidePushed && p.is_pushed) return false;
        return matchesSearch;
    });

    return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
            <Navbar />

            <div style={{ padding: '60px 20px', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        PLAYER REGISTRATION CONTROL
                    </h1>
                </div>

                {/* Search and Filter Bar */}
                <div className="glass" style={{
                    padding: '15px 25px',
                    borderRadius: '16px',
                    marginBottom: '2px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flex: 1 }}>
                        <Search size={18} color="#666" />
                        <input
                            type="text"
                            placeholder="Search Registrations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', outline: 'none', width: '100%', fontWeight: 500 }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                            type="checkbox"
                            id="hidePushed"
                            checked={hidePushed}
                            onChange={(e) => setHidePushed(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        <label htmlFor="hidePushed" style={{ fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', color: '#fff', textTransform: 'uppercase' }}>
                            HIDE PUSHED
                        </label>
                    </div>
                </div>

                {/* Table Layout */}
                <div className="glass" style={{ borderRadius: '0 0 16px 16px', overflowX: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <th style={{ ...thStyle, width: '60px' }}>PHOTO</th>
                                <th style={{ ...thStyle, width: '140px' }}>FULL NAME</th>
                                <th style={{ ...thStyle, width: '100px' }}>CRICKET SKILL</th>
                                <th style={{ ...thStyle, width: '80px' }}>KESHAV CUP PARTICIPATION</th>
                                <th style={{ ...thStyle, width: '130px' }}>SLOTS</th>
                                <th style={{ ...thStyle, width: '120px' }}>PUSH BUTTON</th>
                                <th style={{ ...thStyle, width: '60px' }}>DELETE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '100px', textAlign: 'center', color: '#666' }}>
                                        <RefreshCw size={30} className="rotate" style={{ marginBottom: '15px' }} />
                                        <p>Loading registrations...</p>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '100px', textAlign: 'center', color: '#666', fontSize: '1.1rem', fontWeight: 500 }}>
                                        No registrations found.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((p) => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="table-row-hover">
                                        <td style={tdStyle}>
                                            <div
                                                style={{
                                                    width: '56px',
                                                    height: '56px',
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    background: '#111',
                                                    margin: '0 auto',
                                                    position: 'relative',
                                                    cursor: 'pointer',
                                                    border: '1px solid rgba(255,255,255,0.1)'
                                                }}
                                                className="photo-container"
                                                onClick={() => {
                                                    setSelectedPlayer(p);
                                                    setShowModal(true);
                                                }}
                                            >
                                                <img
                                                    src={fixPhotoUrl(p.photo, p.name)}
                                                    alt=""
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: uploadingId === p.id ? 0.3 : 1 }}
                                                    onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name || 'Player')}`; }}
                                                />
                                                <div className="photo-overlay">
                                                    <Camera size={18} />
                                                </div>
                                                {uploadingId === p.id && (
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <RefreshCw size={18} className="rotate" />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>{p.role}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: p.city === 'હા' ? '#00ff80' : '#888' }}>
                                                {p.city === 'હા' ? 'YES' : 'NO'}
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            {editingSlotId === p.id ? (
                                                <div style={{ display: 'flex', gap: '5px', width: '90%', margin: '0 auto' }}>
                                                    <input
                                                        type="text"
                                                        value={newSlotInput}
                                                        onChange={(e) => setNewSlotInput(e.target.value)}
                                                        autoFocus
                                                        placeholder="Name..."
                                                        onKeyDown={(e) => e.key === 'Enter' && confirmNewSlot(p.id)}
                                                        style={{
                                                            background: '#0a0a0a',
                                                            border: '1px solid var(--primary)',
                                                            color: '#fff',
                                                            fontSize: '0.7rem',
                                                            padding: '5px',
                                                            borderRadius: '4px',
                                                            width: '65%',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => confirmNewSlot(p.id)}
                                                        style={{ background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '4px', fontSize: '0.6rem', padding: '0 6px', fontWeight: 900, cursor: 'pointer' }}
                                                    >
                                                        OK
                                                    </button>
                                                </div>
                                            ) : (
                                                <select
                                                    value={p.occupation || 'Unassigned'}
                                                    onChange={(e) => {
                                                        if (e.target.value === '+ New Slot') {
                                                            setEditingSlotId(p.id);
                                                            setNewSlotInput('');
                                                        } else {
                                                            updateRegistrationSlot(p.id, e.target.value);
                                                        }
                                                    }}
                                                    style={{
                                                        background: '#0a0a0a',
                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                        color: '#fff',
                                                        fontSize: '0.7rem',
                                                        padding: '5px',
                                                        borderRadius: '6px',
                                                        width: '90%',
                                                        fontWeight: 700,
                                                        outline: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="Unassigned" style={{ background: '#0a0a0a', color: '#fff' }}>Unassigned</option>
                                                    {/* Session slots */}
                                                    {allSlots.map(slot => (
                                                        <option key={slot} value={slot} style={{ background: '#0a0a0a', color: '#fff' }}>{slot}</option>
                                                    ))}
                                                    {/* Always show current slot even if not in session list yet */}
                                                    {p.occupation && p.occupation !== 'Unassigned' && !allSlots.includes(p.occupation) && (
                                                        <option key={p.occupation} value={p.occupation} style={{ background: '#0a0a0a', color: '#fff' }}>{p.occupation}</option>
                                                    )}
                                                    <option value="+ New Slot" style={{ background: '#0a0a0a', color: 'var(--primary)', fontWeight: 800 }}>+ New Slot</option>
                                                </select>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            <button
                                                onClick={() => pushToPool(p)}
                                                disabled={pushingId === p.id || p.is_pushed}
                                                className="push-btn"
                                                style={{
                                                    padding: '10px 24px',
                                                    borderRadius: '10px',
                                                    background: p.is_pushed ? 'rgba(0, 255, 128, 0.05)' : 'rgba(255,215,0,0.05)',
                                                    border: `1px solid ${p.is_pushed ? 'rgba(0, 255, 128, 0.3)' : 'rgba(255, 215, 0, 0.3)'}`,
                                                    color: p.is_pushed ? '#00ff80' : 'var(--primary)',
                                                    fontWeight: 900,
                                                    fontSize: '0.65rem',
                                                    cursor: p.is_pushed ? 'default' : 'pointer',
                                                    textTransform: 'uppercase',
                                                    transition: 'all 0.2s ease',
                                                    letterSpacing: '0px'
                                                }}
                                            >
                                                {pushingId === p.id ? '...' : p.is_pushed ? 'PUSHED' : 'PUSH'}
                                            </button>
                                        </td>
                                        <td style={tdStyle}>
                                            <button
                                                onClick={() => deleteRegistration(p.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#ff4b4b',
                                                    cursor: 'pointer',
                                                    opacity: 0.7
                                                }}
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Upload Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="glass"
                            style={{ padding: '40px', borderRadius: '24px', width: '450px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 950, marginBottom: '10px' }}>UPDATE PHOTO</h2>
                            <p style={{ color: '#888', marginBottom: '30px', fontSize: '0.9rem', fontWeight: 600 }}>Update profile picture for <span style={{ color: 'var(--primary)' }}>{selectedPlayer?.name}</span></p>

                            {!useCamera ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: '0.2s' }}
                                        className="modal-btn"
                                    >
                                        <Upload size={24} color="var(--primary)" />
                                        <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>UPLOAD FILE</span>
                                    </button>
                                    <button
                                        onClick={startCamera}
                                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: '0.2s' }}
                                        className="modal-btn"
                                    >
                                        <Camera size={24} color="var(--primary)" />
                                        <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>TAKE PHOTO</span>
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
                                    />
                                    <button
                                        onClick={() => { setShowModal(false); setSelectedPlayer(null); }}
                                        style={{ gridColumn: 'span 2', marginTop: '10px', padding: '12px', background: 'transparent', border: 'none', color: '#ff4b4b', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        CANCEL
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#000', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px' }}>
                                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={capturePhoto}
                                            style={{ flex: 1, padding: '15px', borderRadius: '12px', background: 'var(--primary)', color: '#000', fontWeight: 900, border: 'none', cursor: 'pointer' }}
                                        >
                                            CAPTURE PHOTO
                                        </button>
                                        <button
                                            onClick={stopCamera}
                                            style={{ padding: '15px', borderRadius: '12px', background: 'rgba(255,75,75,0.1)', color: '#ff4b4b', fontWeight: 900, border: '1px solid #ff4b4b', cursor: 'pointer' }}
                                        >
                                            CANCEL
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx>{`
                .rotate { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .table-row-hover:hover { background: rgba(255,255,255,0.02); }
                .push-btn:hover { background: var(--primary) !important; color: #000 !important; }
                th { color: #888; letter-spacing: 1px; }
                
                .photo-container:hover .photo-overlay { opacity: 1; }
                .photo-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.6);
                    display: flex;
                    alignItems: center;
                    justify-content: center;
                    opacity: 0;
                    transition: all 0.2s ease;
                    color: var(--primary);
                }
                .modal-btn:hover {
                    background: rgba(255,215,0,0.05) !important;
                    border-color: var(--primary) !important;
                    transform: translateY(-2px);
                }
            `}</style>
        </main>
    );
}

const thStyle: React.CSSProperties = {
    padding: '10px',
    fontSize: '0.65rem',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap'
};

const tdStyle: React.CSSProperties = {
    padding: '8px 10px',
    textAlign: 'center',
    fontSize: '0.8rem',
    color: '#ddd'
};
