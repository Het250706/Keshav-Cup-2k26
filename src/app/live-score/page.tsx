'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Trophy, Zap, MapPin, Users, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function LiveScorePage() {
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const role = localStorage.getItem('user_role');
        setIsAdmin(role === 'ADMIN');
        fetchMatches();
        const matchSub = supabase.channel('live-scores')
            .on('postgres_changes', { event: '*', table: 'matches', schema: 'public' }, () => fetchMatches())
            .subscribe();

        return () => { supabase.removeChannel(matchSub); };
    }, []);

    const fetchMatches = async () => {
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setMatches(data);
        setLoading(false);
    };

    if (loading) return (
        <main style={{ minHeight: '100vh', background: '#000' }}>
            <Navbar />
            <div style={{ padding: '100px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading live matches...</div>
        </main>
    );

    return (
        <>
            <main style={{ minHeight: '100vh', background: '#000' }}>
                <Navbar />
                <div className="container-responsive" style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        <h1 className="title-gradient" style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: 950, letterSpacing: '-2px' }}>LIVE SCORECARD</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 600 }}>Real-time match updates from Keshav Cup 2026</p>

                        {isAdmin && (
                            <button
                                onClick={() => router.push('/admin/live-score')}
                                className="btn-primary"
                                style={{ marginTop: '20px', padding: '10px 20px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Settings size={16} /> MANAGE MATCHES
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        {matches.length === 0 ? (
                            <div className="glass" style={{ padding: '60px', textAlign: 'center', borderRadius: '30px' }}>
                                <Zap size={48} color="var(--text-muted)" style={{ marginBottom: '20px', opacity: 0.3 }} />
                                <h2 style={{ color: 'var(--text-muted)' }}>No live matches at the moment.</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '10px' }}>Stay tuned for upcoming games!</p>
                            </div>
                        ) : (
                            matches.map((match) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={match.id}
                                    className="glass"
                                    style={{
                                        padding: 'clamp(20px, 5vw, 40px)',
                                        borderRadius: '32px',
                                        border: match.match_status === 'live' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {match.match_status === 'live' && (
                                        <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', background: '#00ff80', borderRadius: '50%' }} className="pulse"></div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#00ff80', letterSpacing: '1px' }}>LIVE</span>
                                        </div>
                                    )}

                                    {/* Match Header */}
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
                                            <MapPin size={14} color="var(--primary)" /> {match.venue.toUpperCase()}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
                                            <Zap size={14} color="var(--primary)" /> {match.toss_winner} WON TOSS & {match.toss_decision.toUpperCase()}
                                        </div>
                                    </div>

                                    {/* Teams & Scores */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
                                        {/* Team 1 */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <div style={{ fontSize: 'clamp(1rem, 4vw, 1.8rem)', fontWeight: 900, letterSpacing: '1px' }}>{match.team1_name}</div>
                                            <div style={{ fontSize: 'clamp(1.5rem, 6vw, 2.5rem)', fontWeight: 950, color: match.batting_team === match.team1_name ? '#fff' : 'var(--text-muted)' }}>
                                                {match.team1_score}<span style={{ color: 'var(--primary)', opacity: 0.8 }}>/{match.team1_wickets}</span>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 700 }}>{match.team1_overs} Overs</div>
                                        </div>

                                        {/* VS */}
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)', opacity: 0.5 }}>VS</div>

                                        {/* Team 2 */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <div style={{ fontSize: 'clamp(1rem, 4vw, 1.8rem)', fontWeight: 900, letterSpacing: '1px' }}>{match.team2_name}</div>
                                            <div style={{ fontSize: 'clamp(1.5rem, 6vw, 2.5rem)', fontWeight: 950, color: match.batting_team === match.team2_name ? '#fff' : 'var(--text-muted)' }}>
                                                {match.team2_score}<span style={{ color: 'var(--primary)', opacity: 0.8 }}>/{match.team2_wickets}</span>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 700 }}>{match.team2_overs} Overs</div>
                                        </div>
                                    </div>

                                    {/* Match Situation */}
                                    <div style={{ marginTop: '40px', padding: '20px', borderRadius: '20px', background: 'rgba(255, 215, 0, 0.05)', textAlign: 'center', border: '1px solid rgba(255, 215, 0, 0.1)' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.5px' }}>
                                            {match.match_status === 'live' ? (
                                                match.current_innings === 1
                                                    ? `${match.batting_team} is batting first`
                                                    : `${match.batting_team} needs ${match.team1_score - match.team2_score + 1} runs to win`
                                            ) : (
                                                match.team1_score > match.team2_score
                                                    ? `${match.team1_name} won by ${match.team1_score - match.team2_score} runs`
                                                    : `${match.team2_name} won by ${match.team1_wickets} wickets`
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </main>
            <style jsx>{`
                .pulse {
                    animation: pulse-glow-dot 1.5s ease-in-out infinite;
                }
                @keyframes pulse-glow-dot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }
            `}</style>
        </>
    );
}
