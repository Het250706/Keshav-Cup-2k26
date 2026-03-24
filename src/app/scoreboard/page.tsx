'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Activity, Trophy, Swords, Target, Timer, TrendingUp, User, UserCheck, Star, Lock, Mail, AlertCircle, Loader2, Menu, X, ChevronRight, ArrowLeft } from 'lucide-react';
import { fixPhotoUrl } from '@/lib/utils';

export default function ScoreboardPage() {
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        if (sessionStorage.getItem('kc_scoreboard_auth') === 'true') {
            setVerified(true);
        }
    }, []);

    if (!verified) {
        return <LoginScreen onSuccess={() => setVerified(true)} />;
    }

    return <ScoreboardContent />;
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const loginEmail = email.trim().toLowerCase();
        const loginPassword = password.trim();
        if (loginEmail === 'bapspetlad@keshav.com' && loginPassword === 'keshavcup2026') {
            sessionStorage.setItem('kc_scoreboard_auth', 'true');
            onSuccess();
        } else {
            setError('Invalid credentials. Please try again.');
        }
        setLoading(false);
    };

    return (
        <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass pulse-border" style={{ width: 'min(480px, 92%)', padding: '50px', margin: '20px', border: '1px solid rgba(255, 215, 0, 0.2)', borderRadius: '32px' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '100%', height: 'auto' }} />
                    </div>
                    <h1 className="title-gradient" style={{ fontSize: '2.8rem', marginBottom: '12px', fontWeight: 950, letterSpacing: '-1.5px' }}>
                        SCOREBOARD
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 800, letterSpacing: '2px' }}>KESHAV CUP 4.0</p>
                </div>

                {error && (
                    <div style={{ background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', padding: '15px', borderRadius: '12px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', border: '1px solid rgba(255, 75, 75, 0.3)' }} className="fade-in">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px' }}>EMAIL</label>
                        <div style={{ position: 'relative' }}>
                            <Mail style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bapspetlad@keshav.com" style={loginInputStyle} required />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px' }}>SECURITY PASSWORD</label>
                        <div style={{ position: 'relative' }}>
                            <Lock style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={loginInputStyle} required />
                        </div>
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '20px', fontSize: '1.2rem', marginTop: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        {loading ? <Loader2 className="animate-spin" size={24} /> : 'SECURE ENTRY'}
                    </button>
                </form>
            </div>
            <style jsx>{`
                .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); }
                .title-gradient { background: linear-gradient(135deg, #ffd700, #ffaa00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
                .btn-primary { background: linear-gradient(135deg, #ffd700, #ffaa00); color: #000; border: none; cursor: pointer; width: 100%; box-shadow: 0 10px 30px rgba(255, 215, 0, 0.2); }
                .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(255, 215, 0, 0.3); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .pulse-border { animation: pulse-border 4s infinite; }
                @keyframes pulse-border { 0%, 100% { border-color: rgba(255, 215, 0, 0.2); } 50% { border-color: rgba(255, 215, 0, 0.5); } }
                .fade-in { animation: fadeIn 0.5s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </main>
    );
}

function ScoreboardContent() {
    const [match, setMatch] = useState<any>(null);
    const [nextMatch, setNextMatch] = useState<any>(null);
    const [innings, setInnings] = useState<any[]>([]);
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [allMatches, setAllMatches] = useState<any[]>([]);
    const [matchFilter, setMatchFilter] = useState<'all' | 'live' | 'completed'>('all');
    const [activeView, setActiveView] = useState<'home' | 'live' | 'matches' | 'teams'>('home');

    const teams = ['AISHWARYAM', 'SHAURYAM', 'DIVYAM', 'GYANAM', 'ASTIKAYAM', 'DASHATVAM', 'SATYAM', 'DHAIRYAM'];

    const handleViewChange = (view: 'home' | 'live' | 'matches' | 'teams') => {
        setActiveView(view);
        setIsMenuOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        fetchScore();
        const channel = supabase.channel('scoreboard_sync')
            .on('postgres_changes', { event: '*', table: 'innings', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'matches', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'player_match_stats', schema: 'public' }, () => fetchScore())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchScore = async () => {
        const { data: liveMatch } = await supabase.from('matches')
            .select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)')
            .eq('status', 'live')
            .order('created_at', { ascending: false })
            .maybeSingle();

        let activeMatch = liveMatch;
        if (!activeMatch) {
            const { data: lastMatch } = await supabase.from('matches')
                .select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)')
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            activeMatch = lastMatch;
        }

        if (activeMatch) {
            setMatch(activeMatch);
            const [{ data: innData }, { data: statsData }, { data: upMatch }] = await Promise.all([
                supabase.from('innings').select('*').eq('match_id', activeMatch.id).order('innings_number', { ascending: true }),
                supabase.from('player_match_stats').select('*, players(*)').eq('match_id', activeMatch.id),
                supabase.from('matches').select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)').eq('status', 'upcoming').order('created_at', { ascending: true }).limit(1).maybeSingle()
            ]);
            if (innData) setInnings(innData);
            if (statsData) setStats(statsData);
            if (upMatch) setNextMatch(upMatch);
        }

        const { data: matchesList } = await supabase.from('matches')
            .select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)')
            .order('created_at', { ascending: false });
        if (matchesList) setAllMatches(matchesList);

        setLoading(false);
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity className="rotate" size={40} color="var(--primary)" />
        </div>
    );

    const currentInn = innings.find(inn => !inn.is_completed) || innings[innings.length - 1];

    const TeamCircle = ({ name }: { name: string }) => {
        const initial = name?.charAt(0) || '?';
        return (
            <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffd700, #ffaa00)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, color: '#000', fontSize: '1.2rem', boxShadow: '0 5px 15px rgba(255, 215, 0, 0.3)' }}>
                {initial}
            </div>
        );
    }

    return (
        <main className="animated-bg" style={{ minHeight: '100vh', color: '#fff', padding: '20px', position: 'relative' }}>
            {/* Hamburger Button */}
            <button onClick={() => setIsMenuOpen(true)} style={{ position: 'fixed', top: '30px', right: '30px', zIndex: 100, background: 'linear-gradient(135deg, #ffd700, #ffaa00)', color: '#000', border: 'none', width: '60px', height: '60px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} className="menu-trigger">
                <Menu size={28} />
            </button>

            {/* Sidebar Overlay */}
            <div onClick={() => setIsMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, opacity: isMenuOpen ? 1 : 0, visibility: isMenuOpen ? 'visible' : 'hidden', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 'min(400px, 85%)', background: '#0a0a0a', padding: '40px', transform: isMenuOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)', borderLeft: '1px solid rgba(255, 215, 0, 0.2)', boxShadow: '-20px 0 50px rgba(0,0,0,0.8)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' }}>
                        <img src="/logo.png" alt="Logo" style={{ height: '60px' }} />
                        <button onClick={() => setIsMenuOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '45px', height: '45px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <X color="#fff" size={24} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            { label: 'HOME', view: 'home', icon: <Star size={20} /> },
                            { label: 'LIVE MATCH', view: 'live', icon: <Activity size={20} /> },
                            { label: 'MATCH HISTORY', view: 'matches', icon: <Swords size={20} /> },
                            { label: 'TEAM LINEUP', view: 'teams', icon: <Trophy size={20} /> }
                        ].map(item => (
                            <button
                                key={item.view}
                                onClick={() => handleViewChange(item.view as any)}
                                className={`sidebar-link ${activeView === item.view ? 'active' : ''}`}
                                style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 25px', borderRadius: '18px', border: 'none', background: activeView === item.view ? 'rgba(255, 215, 0, 0.1)' : 'transparent', color: activeView === item.view ? 'var(--primary)' : '#fff', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', letterSpacing: '1px' }}
                            >
                                <span style={{ color: activeView === item.view ? 'var(--primary)' : 'rgba(255,255,255,0.3)', transition: 'color 0.3s' }}>{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ position: 'absolute', bottom: '40px', left: '40px', right: '40px', padding: '25px', background: 'rgba(255,215,0,0.03)', borderRadius: '24px', border: '1px dashed rgba(255,215,0,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '2px', marginBottom: '8px' }}>KESHAV CUP 4.0</div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>REAL-TIME UPDATES ENABLED</div>
                    </div>
                </div>
            </div>

            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>

                {activeView !== 'home' && (
                    <button onClick={() => setActiveView('home')} style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,215,0,0.2)', padding: '16px 28px', borderRadius: '20px', cursor: 'pointer', marginBottom: '40px', fontWeight: 900, fontSize: '0.9rem', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', backdropFilter: 'blur(10px)' }} className="back-btn fade-in">
                        <ArrowLeft size={20} color="var(--primary)" /> BACK TO HOME
                    </button>
                )}

                {activeView === 'home' && (
                    <div style={{ textAlign: 'center', padding: '80px 20px' }} className="fade-in">
                        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 50px' }}>
                            <img src="/logo.png" alt="Logo" style={{ height: '100%', width: 'auto', filter: 'drop-shadow(0 0 30px rgba(255,215,0,0.2))' }} />
                        </div>
                        <h1 className="title-gradient" style={{ fontSize: 'clamp(3.5rem, 12vw, 6rem)', fontWeight: 950, marginBottom: '0', letterSpacing: '-3px', lineHeight: 1 }}>KESHAV CUP 4.0</h1>
                        <p style={{ color: 'var(--primary)', letterSpacing: '8px', fontWeight: 900, fontSize: '1.4rem', margin: '20px 0 60px' }}>JAY SWAMINARAYAN</p>

                        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5), transparent)', width: '300px', margin: '0 auto 70px' }} />

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
                            <div className="feature-card" onClick={() => setActiveView('live')}>
                                <div className="card-icon-circle">
                                    <Activity size={28} color="#000" />
                                </div>
                                <h3 style={{ fontWeight: 950, fontSize: '1.4rem', marginBottom: '8px', letterSpacing: '-0.5px', color: '#fff' }}>LIVE MATCH</h3>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px' }}>REAL-TIME IMMERSIVE SCOREBOARD</p>
                            </div>
                            <div className="feature-card" onClick={() => setActiveView('matches')}>
                                <div className="card-icon-circle">
                                    <Swords size={28} color="#000" />
                                </div>
                                <h3 style={{ fontWeight: 950, fontSize: '1.4rem', marginBottom: '8px', letterSpacing: '-0.5px', color: '#fff' }}>MATCH HISTORY</h3>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px' }}>TOURNAMENT PROGRESS & RESULTS</p>
                            </div>
                            <div className="feature-card" onClick={() => setActiveView('teams')}>
                                <div className="card-icon-circle">
                                    <Trophy size={28} color="#000" />
                                </div>
                                <h3 style={{ fontWeight: 950, fontSize: '1.4rem', marginBottom: '8px', letterSpacing: '-0.5px', color: '#fff' }}>TOURNAMENT TEAMS</h3>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px' }}>MEET THE 8 MIGHTY WARRIORS</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeView === 'teams' && (
                    <section style={{ marginBottom: '60px' }} className="fade-in">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
                            <div style={{ padding: '15px', background: 'rgba(255,215,0,0.1)', borderRadius: '18px' }}>
                                <Trophy size={36} color="var(--primary)" />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '1.5px', margin: 0 }}>TOURNAMENT TEAMS</h2>
                                <p style={{ color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '2px', fontSize: '0.9rem' }}>KESHAV CUP 4.0 LINEUP</p>
                            </div>
                        </div>
                        <div className="teams-grid">
                            {teams.map(team => (
                                <div key={team} className="team-card premium" style={{ padding: '40px 30px', background: 'rgba(255,255,255,0.03)', borderRadius: '32px', border: '1px solid rgba(255, 215, 0, 0.1)', textAlign: 'center', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                                    <div style={{ position: 'relative', marginBottom: '25px' }}>
                                        <div style={{ position: 'absolute', inset: -15, background: 'rgba(255,215,0,0.05)', borderRadius: '50%', filter: 'blur(10px)' }} />
                                        <img src="/logo.png" alt={team} style={{ width: '90px', height: '90px', margin: '0 auto', position: 'relative', zIndex: 1 }} />
                                    </div>
                                    <div style={{ fontWeight: 950, fontSize: '1.4rem', letterSpacing: '1px', color: 'var(--primary)' }}>{team}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontWeight: 900, marginTop: '8px', letterSpacing: '2px' }}>KESHAV WARRIOR</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {activeView === 'live' && (
                    !match ? (
                        <div style={{ padding: '120px 20px', textAlign: 'center', color: '#fff' }} className="fade-in">
                            <div style={{ width: '120px', height: '120px', background: 'rgba(255,215,0,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 40px' }}>
                                <Swords size={60} color="var(--primary)" />
                            </div>
                            <h1 style={{ fontSize: '3rem', fontWeight: 950, letterSpacing: '1px' }}>NO ACTIVE MATCHES</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 700 }}>The arena is quiet. Stay tuned for live updates!</p>
                        </div>
                    ) : (
                        <div className="fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', background: 'rgba(255,255,255,0.03)', padding: '20px 40px', borderRadius: '60px', border: '1px solid rgba(255,215,0,0.1)', backdropFilter: 'blur(20px)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: match.status === 'live' ? '#00ff80' : '#ff4b4b' }} className={match.status === 'live' ? 'pulse-green' : ''} />
                                    <span style={{ fontWeight: 950, fontSize: '1rem', letterSpacing: '2px' }}>{(match.status || 'Live').toUpperCase()} SESSION</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.5)' }}>
                                    <Timer size={18} className="rotate-slow" />
                                    <span style={{ fontSize: '0.9rem', fontWeight: 900, letterSpacing: '1px' }}>REAL-TIME SYNC ACTIVE</span>
                                </div>
                            </div>

                            <div id="live" className="glass premium" style={{ padding: '80px 40px', borderRadius: '50px', marginBottom: '40px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-100px', right: '-100px', opacity: 0.05 }}>
                                    <Trophy size={400} color="var(--primary)" />
                                </div>
                                <div style={{ textAlign: 'center', marginBottom: '60px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ color: 'var(--primary)', fontWeight: 950, letterSpacing: '4px', fontSize: '1rem', textTransform: 'uppercase' }}>{(match.match_type || 'Tournament').toUpperCase()} • {(match.venue || 'KESAV ARENA').toUpperCase()}</div>
                                    <h1 style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', fontWeight: 950, marginTop: '15px', letterSpacing: '-2px' }}>{match.match_name}</h1>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', gap: '20px md:60px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 950, color: 'var(--primary)', marginBottom: '15px' }}>{match.team1?.name}</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: '10px' }}>INNINGS 1</div>
                                        <ScoreDisplay inn={innings.find(i => i.batting_team_id === match.team1_id)} />
                                    </div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 950, color: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '50%' }}>VS</div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 950, color: 'var(--primary)', marginBottom: '15px' }}>{match.team2?.name}</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: '10px' }}>INNINGS 2</div>
                                        <ScoreDisplay inn={innings.find(i => i.batting_team_id === match.team2_id)} />
                                    </div>
                                </div>

                                {innings.length === 2 && !innings[1].is_completed && innings[0].is_completed && (
                                    <div style={{ marginTop: '60px', padding: '40px', background: 'rgba(0, 255, 128, 0.03)', borderRadius: '32px', border: '1px solid rgba(0, 255, 128, 0.1)', backdropFilter: 'blur(10px)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'rgba(0,255,128,0.6)', fontWeight: 950, letterSpacing: '2px', textTransform: 'uppercase' }}>TARGET CHASE</div>
                                                <div style={{ fontSize: '3rem', fontWeight: 950, color: '#00ff80' }}>{Math.max(0, (innings[0].runs + 1) - innings[1].runs)} <span style={{ fontSize: '1rem', opacity: 0.5 }}>RUNS</span></div>
                                            </div>
                                            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'rgba(0,255,128,0.6)', fontWeight: 950, letterSpacing: '2px', textTransform: 'uppercase' }}>DELIVERIES LEFT</div>
                                                <div style={{ fontSize: '3rem', fontWeight: 950, color: '#00ff80' }}>
                                                    {(() => {
                                                        const totalBalls = (match.max_overs || 8) * 6;
                                                        const currentOvers = innings[1].overs || 0;
                                                        const ballsBowled = Math.floor(currentOvers) * 6 + Math.round((currentOvers - Math.floor(currentOvers)) * 10);
                                                        return Math.max(0, totalBalls - ballsBowled);
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {match.status === 'completed' && match.winner_team_id && (
                                    <div style={{ marginTop: '60px', padding: '30px', background: 'rgba(0, 255, 128, 0.1)', border: '1px solid #00ff80', borderRadius: '32px', textAlign: 'center', boxShadow: '0 0 40px rgba(0, 255, 128, 0.2)' }}>
                                        <h2 style={{ color: '#00ff80', fontWeight: 950, fontSize: '2rem', letterSpacing: '-1px' }}>
                                            {match.result_message || `${match.winner_team_id === match.team1_id ? match.team1?.name : match.team2?.name} TRIUMPHS!`}
                                        </h2>
                                    </div>
                                )}

                                {match.status === 'live' && currentInn && (
                                    <div style={{ marginTop: '60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', padding: '30px', background: 'rgba(255,255,255,0.02)', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                            <div style={{ padding: '15px', background: 'rgba(255,215,0,0.1)', borderRadius: '18px' }}>
                                                <User size={28} color="var(--primary)" />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 950, color: 'rgba(255,215,0,0.5)', letterSpacing: '1px' }}>ON STRIKE</div>
                                                <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>
                                                    {(() => { const player = stats.find(s => s.player_id === currentInn.striker_id); return player ? `${player.players?.first_name} ${player.players?.last_name}` : 'WARRIOR'; })()}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '30px' }}>
                                            <div style={{ padding: '15px', background: 'rgba(0,255,128,0.1)', borderRadius: '18px' }}>
                                                <Activity size={28} color="#00ff80" />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 950, color: 'rgba(0,255,128,0.5)', letterSpacing: '1px' }}>BOWLING</div>
                                                <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>
                                                    {(() => { const player = stats.find(s => s.player_id === currentInn.bowler_id); return player ? `${player.players?.first_name} ${player.players?.last_name}` : 'WARRIOR'; })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div id="stats" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '40px' }}>
                                <div className="glass premium" style={{ padding: '40px', borderRadius: '40px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px' }}>
                                        <div style={{ padding: '12px', background: 'rgba(255,215,0,0.1)', borderRadius: '15px' }}>
                                            <TrendingUp size={24} color="var(--primary)" />
                                        </div>
                                        <h3 style={{ fontWeight: 950, fontSize: '1.5rem', letterSpacing: '1px' }}>TOP PERFORMERS</h3>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                        {stats.sort((a, b) => b.runs - a.runs).slice(0, 5).map((s, idx) => (
                                            <div key={s.player_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 25px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', transition: 'all 0.2s' }} className="hover-scale">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                                    <span style={{ fontWeight: 950, color: 'var(--primary)', fontSize: '0.9rem', width: '20px' }}>{idx + 1}</span>
                                                    <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#111', overflow: 'hidden', border: '2px solid rgba(255,215,0,0.2)' }}>
                                                        <img src={fixPhotoUrl(s.players?.photo_url, s.players?.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.players?.first_name}`; }} />
                                                    </div>
                                                    <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{s.players?.first_name} {s.players?.last_name}</div>
                                                </div>
                                                <div style={{ fontSize: '1.3rem', fontWeight: 950, color: 'var(--primary)' }}>{s.runs} <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>({s.balls})</span></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="glass premium" style={{ padding: '40px', borderRadius: '40px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px' }}>
                                        <div style={{ padding: '12px', background: 'rgba(0,255,128,0.1)', borderRadius: '15px' }}>
                                            <Target size={24} color="#00ff80" />
                                        </div>
                                        <h3 style={{ fontWeight: 950, fontSize: '1.5rem', letterSpacing: '1px' }}>TOP BOWLERS</h3>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                        {stats.sort((a, b) => b.wickets - a.wickets).slice(0, 5).map((s, idx) => (
                                            <div key={s.player_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 25px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', transition: 'all 0.2s' }} className="hover-scale">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                                    <span style={{ fontWeight: 950, color: '#00ff80', fontSize: '0.9rem', width: '20px' }}>{idx + 1}</span>
                                                    <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#111', overflow: 'hidden', border: '2px solid rgba(0,255,128,0.2)' }}>
                                                        <img src={fixPhotoUrl(s.players?.photo_url, s.players?.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.players?.first_name}`; }} />
                                                    </div>
                                                    <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{s.players?.first_name} {s.players?.last_name}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '1.3rem', fontWeight: 950, color: '#00ff80' }}>{s.wickets} <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>WKTS</span></div>
                                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontWeight: 900 }}>{(s.overs || 0).toFixed(1)} OVERS</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                )}

                {activeView === 'live' && nextMatch && (
                    <div className="glass premium fade-in" style={{ padding: '40px', borderRadius: '40px', marginTop: '40px', border: '1px dashed var(--primary)', textAlign: 'center', background: 'rgba(255,215,0,0.02)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 950, letterSpacing: '4px', marginBottom: '15px' }}>UPCOMING SPECTACLE</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                            {nextMatch.team1?.name} <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '1.2rem' }}>VS</span> {nextMatch.team2?.name}
                        </div>
                        <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.4)', marginTop: '10px', fontWeight: 700 }}>{nextMatch.match_name} • {nextMatch.venue || 'KESAV STADIUM'}</div>
                    </div>
                )}

                {activeView === 'matches' && (
                    <section className="fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ padding: '15px', background: 'rgba(255,215,0,0.1)', borderRadius: '18px' }}>
                                    <Swords size={36} color="var(--primary)" />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '1px', margin: 0 }}>MATCH HISTORY</h2>
                                    <p style={{ color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '2px', fontSize: '0.9rem' }}>TOURNAMENT RESULTS</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '18px' }}>
                                {(['all', 'live', 'completed'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setMatchFilter(f)}
                                        style={{ padding: '10px 24px', borderRadius: '14px', background: matchFilter === f ? 'var(--primary)' : 'transparent', color: matchFilter === f ? '#000' : '#fff', border: 'none', fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', letterSpacing: '1px' }}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {allMatches.filter(m => matchFilter === 'all' || m.status === matchFilter).map(m => (
                                <div key={m.id} className="glass premium hover-scale" style={{ padding: '35px', borderRadius: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                            <div style={{ padding: '6px 16px', borderRadius: '50px', background: m.status === 'live' ? 'rgba(0, 255, 128, 0.1)' : 'rgba(255, 255, 255, 0.05)', color: m.status === 'live' ? '#00ff80' : 'rgba(255,255,255,0.4)', border: `1px solid ${m.status === 'live' ? '#00ff80' : 'transparent'}`, fontSize: '0.7rem', fontWeight: 950, letterSpacing: '1px' }} className={m.status === 'live' ? 'pulse-green' : ''}>
                                                {m.status.toUpperCase()}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', fontWeight: 800, letterSpacing: '1px' }}>{m.match_name}</div>
                                            {m.created_at && (
                                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', fontWeight: 800 }}>{new Date(m.created_at).toLocaleDateString()}</div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <TeamCircle name={m.team1?.name} />
                                                <span style={{ fontSize: '1.6rem', fontWeight: 950 }}>{m.team1?.name}</span>
                                            </div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 950, color: 'rgba(255,255,255,0.1)' }}>VS</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <TeamCircle name={m.team2?.name} />
                                                <span style={{ fontSize: '1.6rem', fontWeight: 950 }}>{m.team2?.name}</span>
                                            </div>
                                        </div>
                                        {m.status === 'completed' && m.result_message && (
                                            <div style={{ color: '#00ff80', fontSize: '1rem', fontWeight: 900, marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Star size={18} /> {m.result_message}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                        <ChevronRight color="rgba(255,255,255,0.1)" size={24} />
                                    </div>
                                </div>
                            ))}
                            {allMatches.filter(m => matchFilter === 'all' || m.status === matchFilter).length === 0 && (
                                <div style={{ textAlign: 'center', padding: '80px', color: 'rgba(255,255,255,0.2)', fontWeight: 900, letterSpacing: '2px', background: 'rgba(255,255,255,0.01)', borderRadius: '32px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                                    NO {matchFilter.toUpperCase()} MATCHES RECORDED IN THE ARCHIVES
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>

            <style jsx>{`
                :global(:root) {
                    --primary: #ffd700;
                    --primary-glow: rgba(255, 215, 0, 0.4);
                    --border: rgba(255, 255, 255, 0.1);
                    --text-muted: rgba(255, 255, 255, 0.5);
                }
                
                .animated-bg {
                    background: radial-gradient(circle at top right, #111 0%, #000 70%),
                                radial-gradient(circle at bottom left, #0a0a0a 0%, #000 60%);
                    background-attachment: fixed;
                }
                
                .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid var(--border); transition: all 0.3s ease; }
                
                .premium {
                    border: 1px solid rgba(255, 215, 0, 0.1) !important;
                    box-shadow: 0 15px 40px rgba(0,0,0,0.5);
                }

                .premium:hover {
                    border-color: rgba(255, 215, 0, 0.3) !important;
                    box-shadow: 0 25px 60px rgba(0,0,0,0.7), 0 0 20px rgba(255, 215, 0, 0.05);
                }

                .rotate { animation: rotate 2s linear infinite; }
                .rotate-slow { animation: rotate 10s linear infinite; }
                @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .teams-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; }
                @media (min-width: 992px) { .teams-grid { grid-template-columns: repeat(4, 1fr); } }
                
                .feature-card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,215,0,0.15) !important; padding: 40px; border-radius: 24px; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden; min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
                .feature-card:hover { transform: translateY(-8px); border-color: rgba(255,215,0,0.5) !important; box-shadow: 0 20px 40px rgba(255,215,0,0.1); }
                
                .card-icon-circle { width: 70px; height: 70px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; margin-bottom: 25px; box-shadow: 0 10px 30px rgba(255, 215, 0, 0.3); }
                
                .sidebar-link:hover { padding-left: 35px !important; border-left: 4px solid var(--primary) !important; }
                .sidebar-link.active { border-left: 4px solid var(--primary) !important; }
                
                .hover-scale:hover { transform: scale(1.02); }
                
                .pulse-green { animation: pulse-green 2s infinite; }
                @keyframes pulse-green { 
                    0% { box-shadow: 0 0 0 0 rgba(0, 255, 128, 0.4); } 
                    70% { box-shadow: 0 0 0 15px rgba(0, 255, 128, 0); } 
                    100% { box-shadow: 0 0 0 0 rgba(0, 255, 128, 0); } 
                }

                .title-gradient { background: linear-gradient(135deg, #ffd700, #ffaa00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-shadow: 0 10px 30px rgba(255, 215, 0, 0.1); }
                
                .fade-in { animation: fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

                .menu-trigger:hover { transform: rotate(5deg) scale(1.1); box-shadow: 0 15px 40px rgba(255, 215, 0, 0.4); }
                
                .back-btn:hover { background: rgba(255,255,255,0.08) !important; transform: translateX(-8px); border-color: var(--primary) !important; }
            `}</style>
        </main>
    );
}

function ScoreDisplay({ inn }: { inn: any }) {
    if (!inn) return null;
    return (
        <div style={{ marginTop: '20px' }} className="fade-in">
            <div style={{ fontSize: '5rem', fontWeight: 950, color: 'var(--primary)', letterSpacing: '-2px', lineHeight: 1 }}>{inn.runs}<span style={{ fontSize: '2rem', opacity: 0.5, margin: '0 10px' }}>/</span>{inn.wickets}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', marginTop: '10px', letterSpacing: '4px' }}>{(inn.overs || 0).toFixed(1)} OVERS</div>
        </div>
    );
}

const loginInputStyle = {
    width: '100%',
    padding: '20px 20px 20px 60px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    color: '#fff',
    fontSize: '1.1rem',
    outline: 'none',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box' as const,
    fontWeight: 700,
};