'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Activity, Trophy, Swords, Target, Timer, TrendingUp, User, UserCheck, Star } from 'lucide-react';
import { fixPhotoUrl } from '@/lib/utils';

export default function ScoreboardPage() {
    const [match, setMatch] = useState<any>(null);
    const [nextMatch, setNextMatch] = useState<any>(null);
    const [innings, setInnings] = useState<any[]>([]);
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchScore();
        const interval = setInterval(fetchScore, 3000);
        return () => clearInterval(interval);
    }, []);

    const fetchScore = async () => {
        const { data: liveMatch } = await supabase.from('matches')
            .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)')
            .eq('status', 'live')
            .order('created_at', { ascending: false })
            .maybeSingle();

        let activeMatch = liveMatch;
        if (!activeMatch) {
            const { data: lastMatch } = await supabase.from('matches')
                .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)')
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
                supabase.from('matches').select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)').eq('status', 'scheduled').order('created_at', { ascending: true }).limit(1).maybeSingle()
            ]);

            if (innData) setInnings(innData);
            if (statsData) setStats(statsData);
            if (upMatch) setNextMatch(upMatch);
        }
        setLoading(false);
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity className="rotate" size={40} color="var(--primary)" />
        </div>
    );

    if (!match) return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Swords size={60} color="var(--primary)" style={{ marginBottom: '20px' }} />
            <h1 style={{ fontWeight: 950 }}>NO ACTIVE MATCHES</h1>
            <p style={{ color: 'var(--text-muted)' }}>Stay tuned for upcoming live games!</p>
        </div>
    );

    const currentInn = innings.find(inn => !inn.is_completed) || innings[innings.length - 1];
    const battingTeam = currentInn?.batting_team_id === match.team_a_id ? match.team_a : match.team_b;
    const bowlingTeam = currentInn?.batting_team_id === match.team_a_id ? match.team_b : match.team_a;

    return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '20px' }}>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>

                {/* Status Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: 'rgba(255,255,255,0.03)', padding: '15px 30px', borderRadius: '50px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '10px', height: '100%', aspectRatio: '1', borderRadius: '50%', background: match.status === 'live' ? '#00ff80' : '#ff4b4b', boxShadow: match.status === 'live' ? '0 0 10px #00ff80' : 'none' }} />
                        <span style={{ fontWeight: 900, fontSize: '0.9rem', letterSpacing: '1px' }}>{match.status.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                        <Timer size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>LIVE SYNC EVERY 3S</span>
                    </div>
                </div>

                {/* Main Scoreboard */}
                <div className="glass" style={{ padding: '60px', borderRadius: '40px', marginBottom: '40px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-50px', right: '-50px', opacity: 0.1 }}>
                        <Trophy size={300} color="var(--primary)" />
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        <div style={{ color: 'var(--primary)', fontWeight: 900, letterSpacing: '2px', fontSize: '0.8rem' }}>{match.match_type.toUpperCase()} • {match.venue.toUpperCase()}</div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 950, marginTop: '10px' }}>{match.match_name}</h1>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', gap: '20px md:40px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'clamp(1.2rem, 4vw, 2rem)', fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.team_a.name}</div>
                            {match.status === 'live' && innings[0]?.batting_team_id === match.team_a_id && <ScoreDisplay inn={innings[0]} />}
                            {match.status === 'live' && innings[1]?.batting_team_id === match.team_a_id && <ScoreDisplay inn={innings[1]} />}
                        </div>

                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'rgba(255,255,255,0.2)' }}>VS</div>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'clamp(1.2rem, 4vw, 2rem)', fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.team_b.name}</div>
                            {match.status === 'live' && innings[0]?.batting_team_id === match.team_b_id && <ScoreDisplay inn={innings[0]} />}
                            {match.status === 'live' && innings[1]?.batting_team_id === match.team_b_id && <ScoreDisplay inn={innings[1]} />}
                        </div>
                    </div>

                    {/* Target Logic */}
                    {innings.length === 2 && !innings[1].is_completed && innings[0].is_completed && (
                        <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(0, 255, 128, 0.05)', borderRadius: '20px', border: '1px solid rgba(0, 255, 128, 0.1)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(0,255,128,0.7)', fontWeight: 900, textTransform: 'uppercase' }}>Runs Required</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#00ff80' }}>
                                        {Math.max(0, (innings[0].runs + 1) - innings[1].runs)}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(0,255,128,0.7)', fontWeight: 900, textTransform: 'uppercase' }}>Balls Remaining</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#00ff80' }}>
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
                        <div style={{ marginTop: '40px', padding: '20px', background: 'rgba(0, 255, 128, 0.1)', border: '1px solid #00ff80', borderRadius: '20px', textAlign: 'center' }}>
                            <h2 style={{ color: '#00ff80', fontWeight: 950, fontSize: 'clamp(1rem, 4vw, 1.5rem)' }}>
                                {match.winner_team_id === match.team_a_id ? match.team_a.name : match.team_b.name} WON THE MATCH
                            </h2>
                        </div>
                    )}

                    {/* Live Players Info */}
                    {match.status === 'live' && currentInn && (
                        <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ padding: '8px', background: 'rgba(255,215,0,0.1)', borderRadius: '10px' }}>
                                    <User size={20} color="var(--primary)" />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>BATSMAN</div>
                                    <div style={{ fontWeight: 800 }}>
                                        {(() => {
                                            const player = stats.find(s => s.player_id === currentInn.striker_id);
                                            return player ? `${player.players?.first_name} ${player.players?.last_name}` : 'Waiting...';
                                        })()}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderLeft: '1px solid var(--border)', paddingLeft: '15px' }}>
                                <div style={{ padding: '8px', background: 'rgba(0,255,128,0.1)', borderRadius: '10px' }}>
                                    <Activity size={20} color="#00ff80" />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>BOWLER</div>
                                    <div style={{ fontWeight: 800 }}>
                                    {(() => {
                                            const player = stats.find(s => s.player_id === currentInn.bowler_id);
                                            return player ? `${player.players?.first_name} ${player.players?.last_name}` : 'Waiting...';
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sub-Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>

                    {/* Batsmen Stats */}
                    <div className="glass" style={{ padding: '30px', borderRadius: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                            <TrendingUp size={20} color="var(--primary)" />
                            <h3 style={{ fontWeight: 900 }}>TOP PERFORMERS</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {stats.sort((a, b) => b.runs_scored - a.runs_scored).slice(0, 5).map(s => (
                                <div key={s.player_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: '#222', overflow: 'hidden' }}>
                                            <img src={fixPhotoUrl(s.players?.photo_url, s.players?.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.players?.first_name}`; }} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 800 }}>{s.players?.first_name} {s.players?.last_name}</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{s.runs_scored} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({s.balls_faced})</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bowlers Stats */}
                    <div className="glass" style={{ padding: '30px', borderRadius: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                            <Target size={20} color="#00ff80" />
                            <h3 style={{ fontWeight: 900 }}>TOP BOWLERS</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {stats.sort((a, b) => b.wickets_taken - a.wickets_taken).slice(0, 5).map(s => (
                                <div key={s.player_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: '#222', overflow: 'hidden' }}>
                                            <img src={fixPhotoUrl(s.players?.photo_url, s.players?.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.players?.first_name}`; }} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 800 }}>{s.players?.first_name} {s.players?.last_name}</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{s.wickets_taken} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Wkts</span></div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(s.overs_bowled || 0).toFixed(1)} Overs</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Upcoming Match Section */}
                {nextMatch && (
                    <div className="glass" style={{ padding: '25px', borderRadius: '30px', marginTop: '30px', border: '1px dashed var(--primary)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '2px', marginBottom: '10px' }}>UPCOMING MATCH</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 950 }}>
                            {nextMatch.team_a?.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 15px' }}>VS</span> {nextMatch.team_b?.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>{nextMatch.match_name} • {nextMatch.venue}</div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid var(--border); }
                .rotate { animation: rotate 2s linear infinite; }
                @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </main>
    );
}

function ScoreDisplay({ inn }: { inn: any }) {
    return (
        <div style={{ marginTop: '15px' }}>
            <div style={{ fontSize: '3rem', fontWeight: 950, color: 'var(--primary)' }}>{inn.runs} - {inn.wickets}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-muted)' }}>{inn.overs.toFixed(1)} OVERS</div>
        </div>
    );
}
