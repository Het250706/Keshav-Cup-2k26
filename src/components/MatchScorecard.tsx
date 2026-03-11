'use client';

import { Swords, Target } from 'lucide-react';

export default function MatchScorecard({ teamId, teamName, events }: any) {
    if (!events || events.length === 0) {
        return (
            <div className="glass" style={{ padding: '60px', textAlign: 'center', borderRadius: '35px', maxWidth: '800px', margin: '0 auto' }}>
                <p style={{ color: 'var(--text-muted)' }}>No scoring events recorded for this team yet.</p>
            </div>
        );
    }

    // Aggregates
    const battingStats: any = {};
    const bowlingStats: any = {};
    let totalRuns = 0;
    let totalWickets = 0;
    let totalBalls = 0;
    let extras = 0;

    events.forEach((e: any) => {
        // Batting for requested team
        if (e.striker?.team_id === teamId || e.striker?.sold_team === teamName) {
            if (!battingStats[e.striker_id]) {
                battingStats[e.striker_id] = { 
                    name: e.striker ? `${e.striker.first_name} ${e.striker.last_name}` : 'Unknown Player', 
                    runs: 0, 
                    balls: 0, 
                    fours: 0, 
                    sixes: 0 
                };
            }
            battingStats[e.striker_id].runs += (e.runs_off_bat || 0);
            if (e.extra_type !== 'wide') battingStats[e.striker_id].balls += 1;
            if (e.runs_off_bat === 4) battingStats[e.striker_id].fours += 1;
            if (e.runs_off_bat === 6) battingStats[e.striker_id].sixes += 1;
            
            totalRuns += (e.runs_off_bat || 0) + (e.extras || 0);
            extras += (e.extras || 0);
            if (e.extra_type !== 'wide' && e.extra_type !== 'nb') totalBalls += 1;
            if (e.is_wicket) totalWickets += 1;
        }

        // Bowling for requested team
        if (e.bowler?.team_id === teamId || e.bowler?.sold_team === teamName) {
            if (!bowlingStats[e.bowler_id]) {
                bowlingStats[e.bowler_id] = { 
                    name: e.bowler ? `${e.bowler.first_name} ${e.bowler.last_name}` : 'Unknown Bowler', 
                    overs: 0, 
                    runs: 0, 
                    wickets: 0, 
                    balls: 0 
                };
            }
            if (e.extra_type !== 'wide' && e.extra_type !== 'nb') bowlingStats[e.bowler_id].balls += 1;
            bowlingStats[e.bowler_id].runs += (e.runs_off_bat || 0) + (e.extras || 0);
            if (e.is_wicket) bowlingStats[e.bowler_id].wickets += 1;
        }
    });

    const formatOvers = (balls: number) => {
        return `${Math.floor(balls / 6)}.${balls % 6}`;
    };

    return (
        <div className="glass scorecard-container" style={{ padding: 'clamp(20px, 5vw, 40px)', borderRadius: '35px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h2 style={{ fontSize: 'clamp(1.5rem, 6vw, 2.2rem)', fontWeight: 950, color: 'var(--primary)' }}>{teamName.toUpperCase()}</h2>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(20px, 8vw, 60px)', marginTop: '10px' }}>
                    <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '1px' }}>SCORE</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 950 }}>{totalRuns} - {totalWickets}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '1px' }}>OVERS</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 950 }}>{formatOvers(totalBalls)}</div>
                    </div>
                </div>
                {extras > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '10px', fontWeight: 700 }}>Extras: {extras}</div>}
            </div>

            <div style={{ marginBottom: '40px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 950, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                    <Swords size={20} color="var(--primary)" /> BATTING SCORECARD
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800 }}>PLAYER</th>
                                <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, textAlign: 'right' }}>R</th>
                                <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, textAlign: 'right' }}>B</th>
                                <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, textAlign: 'right' }}>4s</th>
                                <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, textAlign: 'right' }}>6s</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.values(battingStats).length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No batting data yet.</td></tr>
                            ) : Object.values(battingStats).map((s: any, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                    <td style={{ padding: '15px 10px', fontWeight: 800, fontSize: '0.95rem' }}>{s.name}</td>
                                    <td style={{ padding: '15px 10px', fontWeight: 950, textAlign: 'right', color: 'var(--primary)' }}>{s.runs}</td>
                                    <td style={{ padding: '15px 10px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 700 }}>{s.balls}</td>
                                    <td style={{ padding: '15px 10px', textAlign: 'right' }}>{s.fours}</td>
                                    <td style={{ padding: '15px 10px', textAlign: 'right' }}>{s.sixes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 950, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                    <Target size={20} color="#00ff80" /> BOWLING SCORECARD
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800 }}>BOWLER</th>
                                <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, textAlign: 'right' }}>O</th>
                                <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, textAlign: 'right' }}>R</th>
                                <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, textAlign: 'right' }}>W</th>
                            </tr>
                        </thead>
                        <tbody>
                             {Object.values(bowlingStats).length === 0 ? (
                                <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No bowling data yet.</td></tr>
                            ) : Object.values(bowlingStats).map((s: any, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                    <td style={{ padding: '15px 10px', fontWeight: 800, fontSize: '0.95rem' }}>{s.name}</td>
                                    <td style={{ padding: '15px 10px', fontWeight: 900, textAlign: 'right' }}>{formatOvers(s.balls)}</td>
                                    <td style={{ padding: '15px 10px', color: '#ff4b4b', textAlign: 'right', fontWeight: 800 }}>{s.runs}</td>
                                    <td style={{ padding: '15px 10px', color: '#00ff80', textAlign: 'right', fontWeight: 950 }}>{s.wickets}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <style jsx>{`
                .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid var(--border); }
            `}</style>
        </div>
    );
}
