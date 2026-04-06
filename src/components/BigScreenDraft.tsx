'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import DraftCard from './DraftCard';
import TeamTurnBanner from './TeamTurnBanner';
import WelcomeModal from './WelcomeModal';

export default function BigScreenDraft() {
    const [players, setPlayers] = useState<any[]>([]);
    const [draftState, setDraftState] = useState<any>(null);
    const [revealedPlayer, setRevealedPlayer] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const fetchData = async () => {
        // Fetch current draft state with joining teams info
        const { data: state, error: stateError } = await supabase
            .from('draft_state')
            .select('*, teams(*)')
            .maybeSingle();

        if (state) {
            setDraftState(state);
            // Fetch players for the current slot
            const { data: p } = await supabase
                .from('players')
                .select('*')
                .eq('slot_number', state.current_slot)
                .order('created_at', { ascending: true });
            
            setPlayers(p || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();

        // Real-time synchronization
        const channel = supabase.channel('draft_big_screen_v40')
            .on('postgres_changes', { event: '*', table: 'draft_state', schema: 'public' }, (payload) => {
                // If state changed, refresh everything
                fetchData();
            })
            .on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, (payload) => {
                // If a player was selected, we might want to trigger the flip if it's the one currently being clicked
                if (payload.new && payload.new.is_selected) {
                    // Update state to show revealed player locally
                    setPlayers(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleFlip = async (player: any) => {
        if (draftState?.is_reveal_open || player.is_selected) return;

        try {
            const res = await fetch('/api/draft/select-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: player.id })
            });

            if (res.ok) {
                // Trigger Sound Effect (optional, if file exists)
                if (audioRef.current) audioRef.current.play().catch(() => {});
                
                // Trigger Confetti
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#ffd700', '#ffffff', '#ffaa00']
                });

                // Show welcome modal
                setRevealedPlayer(player);
            }
        } catch (err) {
            console.error('Pick error:', err);
        }
    };

    const handleCloseModal = async () => {
        setRevealedPlayer(null);
        await fetch('/api/draft/next-turn', { method: 'POST' });
    };

    if (loading) return (
        <div style={{ height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 900, fontSize: '2rem', letterSpacing: '10px' }}>
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                LOADING DRAFT ARENA...
            </motion.div>
        </div>
    );

    if (!draftState) return (
        <div style={{ height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
             <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center', padding: '40px', border: '1px dashed rgba(255,215,0,0.3)', borderRadius: '30px', maxWidth: '600px' }}
             >
                <div style={{ fontSize: '1.2rem', fontWeight: 950, color: 'var(--primary)', marginBottom: '20px', letterSpacing: '2px' }}>DRAFT ARENA STANDBY</div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 950, marginBottom: '25px', color: '#ff4b4b' }}>SYSTEM NOT INITIALIZED</h2>
                
                <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '25px', borderRadius: '20px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>
                    <p style={{ marginBottom: '10px', color: '#fff', fontWeight: 800 }}>Please follow these steps to begin:</p>
                    <ol style={{ marginLeft: '20px' }}>
                        <li>Go to <b>Admin Dashboard</b></li>
                        <li>Open <b>SLOTS</b> Management</li>
                        <li>Click <b>OPEN DRAFT CONSOLE</b></li>
                        <li>Setup <b>DRAFT ORDER</b> (Team Sequence)</li>
                        <li>Click <b>START DRAFT</b> for any Slot</li>
                    </ol>
                </div>
                <p style={{ marginTop: '25px', fontSize: '0.7rem', opacity: 0.5 }}>This screen will automatically start once the draft begins.</p>
             </motion.div>
        </div>
    );

    return (
        <main style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(to bottom, #000, #0a0a0a)', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Background elements */}
             <div style={{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '10%', left: '5%', width: '400px', height: '400px', background: 'var(--primary)', filter: 'blur(150px)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: '500px', height: '500px', background: '#004ba0', filter: 'blur(180px)', borderRadius: '50%' }} />
            </div>

            <TeamTurnBanner team={draftState.teams} />

            <div style={{ 
                flex: 1, 
                padding: '60px 80px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                zIndex: 1
            }}>
                <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                    <div style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 950, letterSpacing: '6px', textTransform: 'uppercase' }}>
                        Slot {draftState.current_slot} • Group Release
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(280px, 1fr))',
                    gap: '40px',
                    width: '100%',
                    maxWidth: '1400px'
                }}>
                    <AnimatePresence>
                        {players.map((p, i) => (
                            <motion.div 
                                key={p.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <DraftCard 
                                    player={p} 
                                    isRevealed={p.is_selected} 
                                    onFlip={() => handleFlip(p)}
                                    disabled={draftState.is_reveal_open}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Stats Overlay at Bottom */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px 60px', display: 'flex', justifyContent: 'center', gap: '80px', borderTop: '1px solid rgba(255,215,0,0.1)', backdropFilter: 'blur(10px)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' }}>Total Players in Slot</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 950, color: 'var(--primary)' }}>{players.length}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' }}>Remaining Cards</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#fff' }}>{players.filter(p => !p.is_selected).length}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' }}>Selected Cards</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#00ff80' }}>{players.filter(p => p.is_selected).length}</div>
                </div>
            </div>

            <AnimatePresence>
                {revealedPlayer && (
                    <WelcomeModal 
                        player={revealedPlayer} 
                        team={draftState.teams} 
                        onClose={handleCloseModal}
                    />
                )}
            </AnimatePresence>

            <audio ref={audioRef} src="/reveal_sound.mp3" preload="auto" />
        </main>
    );
}
