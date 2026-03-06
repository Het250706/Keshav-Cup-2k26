'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Plus, Trash2, Zap, Save, RefreshCw, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

import RoleGuard from '@/components/RoleGuard';

export default function AdminLiveScorePage() {
    return (
        <RoleGuard allowedRole="admin">
            <AdminLiveScoreContent />
        </RoleGuard>
    );
}

function AdminLiveScoreContent() {
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newMatch, setNewMatch] = useState({
        team1_name: '',
        team2_name: '',
        venue: 'Main Stadium',
        match_status: 'scheduled' as const,
        toss_winner: '',
        toss_decision: 'bat' as const,
        batting_team: ''
    });

    useEffect(() => {
        fetchMatches();
    }, []);

    const fetchMatches = async () => {
        const { data } = await supabase.from('matches').select('*').order('created_at', { ascending: false });
        if (data) setMatches(data);
        setLoading(false);
    };

    const createMatch = async () => {
        const { data, error } = await supabase.from('matches').insert([{
            ...newMatch,
            team1_score: 0,
            team1_wickets: 0,
            team1_overs: '0.0',
            team2_score: 0,
            team2_wickets: 0,
            team2_overs: '0.0',
            current_innings: 1,
            batting_team: newMatch.team1_name // Default
        }]).select();

        if (error) alert(error.message);
        else {
            setIsCreating(false);
            fetchMatches();
        }
    };

    const updateScore = async (matchId: string, updates: any) => {
        const { error } = await supabase.from('matches').update(updates).eq('id', matchId);
        if (error) alert(error.message);
        else fetchMatches();
    };

    const deleteMatch = async (matchId: string) => {
        if (!confirm('Are you sure you want to delete this match?')) return;
        const { error } = await supabase.from('matches').delete().eq('id', matchId);
        if (error) alert(error.message);
        else fetchMatches();
    };

    if (loading) return <div style={{ color: 'white', textAlign: 'center', padding: '100px' }}>Loading...</div>;

    return (
        <main style={{ minHeight: '100vh', background: '#000' }}>
            <Navbar />

            <div className="container-responsive" style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 900 }}>Match <span style={{ color: 'var(--primary)' }}>Center</span></h1>
                        <p style={{ color: 'var(--text-muted)' }}>Admin control for live scoring</p>
                    </div>
                    <button onClick={() => setIsCreating(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} /> CREATE NEW MATCH
                    </button>
                </div>

                {isCreating && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="glass" style={{ padding: '30px', borderRadius: '24px', marginBottom: '40px' }}>
                        <h2 style={{ marginBottom: '25px', fontSize: '1.2rem', color: 'var(--primary)' }}>New Match Configuration</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                            <div className="input-field">
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>TEAM 1 NAME</label>
                                <input style={inputStyle} value={newMatch.team1_name} onChange={e => setNewMatch({ ...newMatch, team1_name: e.target.value })} placeholder="e.g. SHAURYAM" />
                            </div>
                            <div className="input-field">
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>TEAM 2 NAME</label>
                                <input style={inputStyle} value={newMatch.team2_name} onChange={e => setNewMatch({ ...newMatch, team2_name: e.target.value })} placeholder="e.g. DIVYAM" />
                            </div>
                            <div className="input-field">
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>VENUE</label>
                                <input style={inputStyle} value={newMatch.venue} onChange={e => setNewMatch({ ...newMatch, venue: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', marginTop: '25px' }}>
                            <button onClick={createMatch} className="btn-primary">START MATCH</button>
                            <button onClick={() => setIsCreating(false)} className="btn-secondary">CANCEL</button>
                        </div>
                    </motion.div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    {matches.map(match => (
                        <div key={match.id} className="glass" style={{ padding: '30px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{match.team1_name} vs {match.team2_name}</div>
                                    <span style={{ fontSize: '0.7rem', background: match.match_status === 'live' ? '#00ff80' : '#444', color: '#000', padding: '2px 8px', borderRadius: '4px', fontWeight: 900 }}>
                                        {match.match_status.toUpperCase()}
                                    </span>
                                </div>
                                <button onClick={() => deleteMatch(match.id)} style={{ color: '#ff4b4b', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={20} /></button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                                {/* Team 1 Control */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '15px' }}>
                                    <h3 style={{ fontSize: '0.9rem', marginBottom: '15px', color: 'var(--primary)' }}>{match.team1_name} (Inn 1)</h3>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RUNS</label>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button onClick={() => updateScore(match.id, { team1_score: match.team1_score - 1 })} style={scoreBtn}>-</button>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 900, minWidth: '40px', textAlign: 'center' }}>{match.team1_score}</div>
                                                <button onClick={() => updateScore(match.id, { team1_score: match.team1_score + 1 })} style={scoreBtn}>+</button>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>WICKETS</label>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button onClick={() => updateScore(match.id, { team1_wickets: match.team1_wickets - 1 })} style={scoreBtn}>-</button>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 900, minWidth: '30px', textAlign: 'center' }}>{match.team1_wickets}</div>
                                                <button onClick={() => updateScore(match.id, { team1_wickets: match.team1_wickets + 1 })} style={scoreBtn}>+</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '15px' }}>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OVERS</label>
                                        <input style={inputStyle} value={match.team1_overs} onChange={e => updateScore(match.id, { team1_overs: e.target.value })} />
                                    </div>
                                </div>

                                {/* Team 2 Control */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '15px' }}>
                                    <h3 style={{ fontSize: '0.9rem', marginBottom: '15px', color: 'var(--primary)' }}>{match.team2_name} (Inn 2)</h3>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RUNS</label>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button onClick={() => updateScore(match.id, { team2_score: match.team2_score - 1 })} style={scoreBtn}>-</button>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 900, minWidth: '40px', textAlign: 'center' }}>{match.team2_score}</div>
                                                <button onClick={() => updateScore(match.id, { team2_score: match.team2_score + 1 })} style={scoreBtn}>+</button>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>WICKETS</label>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button onClick={() => updateScore(match.id, { team2_wickets: match.team2_wickets - 1 })} style={scoreBtn}>-</button>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 900, minWidth: '30px', textAlign: 'center' }}>{match.team2_wickets}</div>
                                                <button onClick={() => updateScore(match.id, { team2_wickets: match.team2_wickets + 1 })} style={scoreBtn}>+</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '15px' }}>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OVERS</label>
                                        <input style={inputStyle} value={match.team2_overs} onChange={e => updateScore(match.id, { team2_overs: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '25px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                <button onClick={() => updateScore(match.id, { match_status: 'live' })} className="btn-secondary" style={{ fontSize: '0.8rem', borderColor: '#00ff80', color: '#00ff80' }}>SET LIVE</button>
                                <button onClick={() => updateScore(match.id, { match_status: 'completed' })} className="btn-secondary" style={{ fontSize: '0.8rem' }}>SET COMPLETED</button>
                                <button onClick={() => updateScore(match.id, { batting_team: match.batting_team === match.team1_name ? match.team2_name : match.team1_name })} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                                    SWITCH BATTING: {match.batting_team}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}

const inputStyle = {
    width: '100%',
    padding: '10px 15px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    color: '#fff',
    outline: 'none',
    fontSize: '0.9rem'
};

const scoreBtn = {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1.2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900
};
