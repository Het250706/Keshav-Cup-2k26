'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fixPhotoUrl } from '@/lib/utils';
import Navbar from '@/components/Navbar';
import { 
    ChevronRight, Settings, Users, Save, Play, Square, Trophy, Target, TrendingUp, Hand, 
    UserCheck, Search, Trash2, Shield, User, Loader2, Plus, Zap, RefreshCw, 
    ChevronLeft, UserPlus, Activity, Download 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RoleGuard from '@/components/RoleGuard';
import MatchScorecard from '@/components/MatchScorecard';
export default function AdminLiveScorePage() {
    return (
        <RoleGuard allowedRole="admin">
            <AdminLiveScoreContent />
        </RoleGuard>
    );
}

function AdminLiveScoreContent() {
    // UI State
    const [view, setView] = useState<'matches' | 'create' | 'squad' | 'toss' | 'scoring' | 'stats' | 'report'>('matches');
    const [loading, setLoading] = useState(true);
    const [activeMatch, setActiveMatch] = useState<any>(null);

    // Data State
    const [matches, setMatches] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [teamAPlayers, setTeamAPlayers] = useState<any[]>([]);
    const [teamBPlayers, setTeamBPlayers] = useState<any[]>([]);
    const [matchPlayersA, setMatchPlayersA] = useState<any[]>([]);
    const [matchPlayersB, setMatchPlayersB] = useState<any[]>([]);
    const [selectedSquadA, setSelectedSquadA] = useState<string[]>([]);
    const [selectedSquadB, setSelectedSquadB] = useState<string[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        match_name: '',
        match_type: 'League Match',
        team_a_id: '',
        team_b_id: '',
        venue: 'Main Stadium',
        max_overs: '8'
    });

    const [tossData, setTossData] = useState({
        toss_winner_id: '',
        toss_decision: 'Batting'
    });

    // Scoring State
    const [currentInnings, setCurrentInnings] = useState<any>(null);
    const [strikerId, setStrikerId] = useState('');
    const [bowlerId, setBowlerId] = useState('');
    const [showWicketModal, setShowWicketModal] = useState(false);
    const [selectedWicketType, setSelectedWicketType] = useState('Bowled');
    const [dismissedId, setDismissedId] = useState('');
    const [firstInningsRuns, setFirstInningsRuns] = useState<number | null>(null);
    const [scoringTab, setScoringTab] = useState<'live' | 'team_a' | 'team_b'>('live');
    const [matchEvents, setMatchEvents] = useState<any[]>([]);

    // Stats State
    const [tournamentStats, setTournamentStats] = useState<any[]>([]);

    const getTeamName = (teamId: string) => {
        if (!teamId) return 'TBD';
        const team = teams?.find(t => t.id === teamId);
        if (team?.name) return team.name;
        if (teamId === activeMatch?.team_a_id && activeMatch?.team_a?.name) return activeMatch.team_a.name;
        if (teamId === activeMatch?.team_b_id && activeMatch?.team_b?.name) return activeMatch.team_b.name;
        return teamId === activeMatch?.team_a_id ? 'Team A' : 'Team B';
    };

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        setLoading(true);
        await Promise.all([fetchMatches(), fetchTeams(), fetchTournamentStats()]);
        setLoading(false);
    };

    const fetchTournamentStats = async () => {
        const { data } = await supabase.from('tournament_player_stats').select('*').order('total_runs', { ascending: false });
        if (data) setTournamentStats(data);
    };

    const fetchMatches = async () => {
        const { data, error } = await supabase.from('matches').select('*, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name)').order('created_at', { ascending: false });
        if (error) {
            console.error('FETCH_MATCHES_ERROR:', error);
            if (error.code === 'PGRST204' || error.code === '42P01' || error.message.includes('not found')) {
                alert('Database tables are missing! Please run the LIVESCORE_UPGRADE.sql script in your Supabase SQL Editor.');
            }
        }
        if (data) setMatches(data);
    };

    const fetchTeams = async () => {
        const { data } = await supabase.from('teams').select('id, name');
        if (data) setTeams(data);
    };

    const handleDeleteMatch = async (matchId: string) => {
        if (!confirm('🚨 EMERGENCY DELETE: This will permanently remove all scores, innings, and player stats for this match. Are you sure?')) return;

        const { error } = await supabase.from('matches').delete().eq('id', matchId);

        if (error) {
            console.error('DELETE_MATCH_ERROR:', error);
            alert(`Error deleting match: ${error.message}. You might need to delete related data first if CASCADE is not enabled.`);
        } else {
            alert('Match deleted successfully');
            await fetchMatches();
        }
    };

    // --- VIEW HANDLERS ---

    const handleCreateMatch = async () => {
        if (!formData.team_a_id || !formData.team_b_id || formData.team_a_id === formData.team_b_id) {
            alert('Please select two different teams');
            return;
        }

        const { data, error } = await supabase.from('matches').insert([{
            match_name: formData.match_name,
            match_type: formData.match_type,
            team_a_id: formData.team_a_id,
            team_b_id: formData.team_b_id,
            venue: formData.venue,
            max_overs: parseInt(formData.max_overs),
            status: 'scheduled'
        }]).select().single();

        if (error) {
            console.error('CREATE_MATCH_ERROR:', error);
            alert(`Error creating match: ${error.message || 'Unknown error'} (Code: ${error.code})`);
            if (error.code === '42P01') {
                alert('Table "matches" does not exist. Please run the SQL migration script.');
            }
        } else {
            await fetchMatches();
            setActiveMatch(data);
            await prepareSquad(data);
            setView('squad');
        }
    };

    const handleContinueMatch = async (match: any) => {
        setLoading(true);
        setActiveMatch(match);

        // 1. Fetch Latest Innings
        const { data: inn } = await supabase
            .from('innings')
            .select('*')
            .eq('match_id', match.id)
            .order('innings_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        // 2. Fetch Match Squads (required for both Toss and Scoring)
        await fetchMatchSquad(match);

        if (inn) {
            setCurrentInnings(inn);
            if (inn.innings_number === 2) {
                const { data: inn1 } = await supabase.from('innings').select('runs').eq('match_id', match.id).eq('innings_number', 1).single();
                if (inn1) setFirstInningsRuns(inn1.runs);
            }
            if (match.status === 'completed') {
                setScoringTab('team_a');
            } else {
                setScoringTab('live');
            }
            fetchMatchEvents(match.id);
            setView('scoring');
        } else {
            // No innings yet, check if squads are saved
            const { count } = await supabase
                .from('match_players')
                .select('*', { count: 'exact', head: true })
                .eq('match_id', match.id);

            if (count && count > 0) {
                setView('toss');
            } else {
                await prepareSquad(match);
                setView('squad');
            }
        }
        setLoading(false);
    };

    const prepareSquad = async (match: any) => {
        if (!match) return;

        // Reset current squads
        setTeamAPlayers([]);
        setTeamBPlayers([]);
        setSelectedSquadA([]);
        setSelectedSquadB([]);

        try {
            // Get team details for name-based lookup fallback
            const { data: tA } = await supabase.from('teams').select('name').eq('id', match.team_a_id).single();
            const { data: tB } = await supabase.from('teams').select('name').eq('id', match.team_b_id).single();

            // Broad search for Team A players (matches by UUID OR by Name)
            let qA = supabase.from('players').select('*');
            if (tA?.name) {
                qA = qA.or(`team_id.eq.${match.team_a_id},sold_team.eq."${tA.name}"`);
            } else {
                qA = qA.eq('team_id', match.team_a_id);
            }
            const { data: pA } = await qA;

            // Broad search for Team B players
            let qB = supabase.from('players').select('*');
            if (tB?.name) {
                qB = qB.or(`team_id.eq.${match.team_b_id},sold_team.eq."${tB.name}"`);
            } else {
                qB = qB.eq('team_id', match.team_b_id);
            }
            const { data: pB } = await qB;

            if (pA) setTeamAPlayers(pA);
            if (pB) setTeamBPlayers(pB);
        } catch (err) {
            console.error('PREPARE_SQUAD_ERROR:', err);
        }
    };

    const handleSaveSquad = async () => {
        if (!activeMatch) { alert('No active match found'); return; }
        if (selectedSquadA.length === 0 || selectedSquadB.length === 0) {
            alert('Please select at least one player for each team');
            return;
        }

        const matchPlayers = [
            ...selectedSquadA.map(pid => ({ match_id: activeMatch.id, player_id: pid, team_id: activeMatch.team_a_id })),
            ...selectedSquadB.map(pid => ({ match_id: activeMatch.id, player_id: pid, team_id: activeMatch.team_b_id }))
        ];

        const { error } = await supabase.from('match_players').insert(matchPlayers);
        if (error) {
            console.error(error);
            alert('Error saving squads');
        } else {
            setView('toss');
        }
    };

    const handleSaveToss = async () => {
        if (!tossData.toss_winner_id || !activeMatch) {
            alert('Please select toss winner and ensure match data is loaded');
            return;
        }

        let battingFirstId = tossData.toss_winner_id;
        if (tossData.toss_decision === 'Bowling') {
            battingFirstId = tossData.toss_winner_id === activeMatch.team_a_id ? activeMatch.team_b_id : activeMatch.team_a_id;
        }

        const bowlingFirstId = battingFirstId === activeMatch.team_a_id ? activeMatch.team_b_id : activeMatch.team_a_id;

        const { error } = await supabase.from('matches').update({
            toss_winner_id: tossData.toss_winner_id,
            toss_decision: tossData.toss_decision,
            batting_first_id: battingFirstId,
            status: 'live'
        }).eq('id', activeMatch.id);

        if (error) alert('Error saving toss');
        else {
            const { data: inn, error: innError } = await supabase.from('innings').insert([{
                match_id: activeMatch.id,
                innings_number: 1,
                batting_team_id: battingFirstId,
                bowling_team_id: bowlingFirstId
            }]).select().single();

            if (innError) alert('Error initializing innings');
            else {
                setCurrentInnings(inn);
                await fetchMatchSquad(activeMatch);
                setView('scoring');
            }
        }
    };

    const fetchMatchSquad = async (match: any) => {
        if (!match) return;
        const { data } = await supabase.from('match_players').select('*, players(*)').eq('match_id', match.id);
        if (data) {
            setMatchPlayersA(data.filter((p: any) => p.team_id === match.team_a_id).map((p: any) => p.players));
            setMatchPlayersB(data.filter((p: any) => p.team_id === match.team_b_id).map((p: any) => p.players));
        }
    };

    // --- SYNC LIVE PLAYERS ---
    useEffect(() => {
        if (!currentInnings || (!strikerId && !bowlerId)) return;
        
        const syncPlayers = async () => {
            await supabase.from('innings').update({
                striker_id: strikerId || null,
                bowler_id: bowlerId || null
            }).eq('id', currentInnings.id);
        };
        
        syncPlayers();
    }, [strikerId, bowlerId, currentInnings?.id]);

    const fetchMatchEvents = async (matchId: string) => {
        const { data } = await supabase.from('match_events').select('*, striker:players!striker_id(*), bowler:players!bowler_id(*), dismissed:players!dismissed_player_id(*)').eq('match_id', matchId).order('created_at', { ascending: true });
        if (data) setMatchEvents(data);
    };

    // --- SCORING ACTIONS ---

    const recordBall = async (runs: number, isWicket: boolean = false, extraType: 'none' | 'wide' | 'nb' = 'none') => {
        if (!strikerId || !bowlerId || !currentInnings) {
            alert('Please select striker and bowler');
            return;
        }

        if (isWicket && !showWicketModal) {
            setDismissedId(strikerId);
            setShowWicketModal(true);
            return;
        }

        const isLegalBall = extraType === 'none';
        const extraRuns = (extraType === 'wide' || extraType === 'nb') ? 1 : 0;
        const totalBallRuns = runs + extraRuns;

        // 1. Calculate Score & Overs
        const newRuns = (currentInnings.runs || 0) + totalBallRuns;
        const newWickets = (currentInnings.wickets || 0) + (isWicket ? 1 : 0);
        
        let currentOvers = currentInnings.overs || 0;
        let oversInt = Math.floor(currentOvers);
        let balls = Math.round((currentOvers - oversInt) * 10);
        
        if (isLegalBall) {
            balls++;
            if (balls >= 6) {
                oversInt++;
                balls = 0;
            }
        }
        const nextOver = oversInt + (balls / 10);

        // 2. Update Innings in DB
        const { error: innErr } = await supabase.from('innings').update({
            runs: newRuns,
            wickets: newWickets,
            overs: nextOver
        }).eq('id', currentInnings.id);

        if (innErr) { alert('Error updating scoreboard'); return; }

        // 3. Record Event
        await supabase.from('match_events').insert([{
            match_id: activeMatch.id,
            innings_number: currentInnings.innings_number,
            striker_id: strikerId,
            bowler_id: bowlerId,
            runs_off_bat: (extraType === 'none' || extraType === 'nb') ? runs : 0,
            extras: extraRuns + (extraType === 'none' ? 0 : runs),
            extra_type: extraType !== 'none' ? extraType : null,
            is_wicket: isWicket,
            wicket_type: isWicket ? selectedWicketType : null,
            dismissed_player_id: isWicket ? dismissedId : null,
            over_number: Math.floor(nextOver),
            ball_number: balls || 6
        }]);

        fetchMatchEvents(activeMatch.id);

        // 4. Refresh State & Check For Innings Completion / Target Reached
        const { data: refreshedInn } = await supabase.from('innings').select('*').eq('id', currentInnings.id).single();
        if (refreshedInn) {
            setCurrentInnings(refreshedInn);
            const maxOvers = activeMatch?.max_overs || 8;
            
            // Auto-detect Over Completion
            if (isLegalBall && balls === 0) {
                alert('Over completed! Please change the bowler.');
                setBowlerId('');
            }

            // Check Target Reached (2nd Innings)
            if (refreshedInn.innings_number === 2 && firstInningsRuns !== null) {
                if (refreshedInn.runs > firstInningsRuns) {
                    alert('TARGET REACHED! MATCH ENDED.');
                    await endInnings();
                    return;
                }
            }

            if (refreshedInn.overs >= maxOvers) {
                alert('Innings Complete! Overs Finished.');
                endInnings();
            }
        }

        if (isWicket) {
            setShowWicketModal(false);
            setStrikerId('');
        }
    };

    const handleUndo = async () => {
        if (!currentInnings || !confirm('Undo last ball?')) return;

        const { data: lastEvent } = await supabase
            .from('match_events')
            .select('*')
            .eq('match_id', activeMatch.id)
            .eq('innings_number', currentInnings.innings_number)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!lastEvent) {
            alert('No balls to undo');
            return;
        }

        await supabase.from('match_events').delete().eq('id', lastEvent.id);

        const { data: allEvents } = await supabase
            .from('match_events')
            .select('*')
            .eq('match_id', activeMatch.id)
            .eq('innings_number', currentInnings.innings_number);

        let totalRuns = 0;
        let totalWickets = 0;
        let legalBalls = 0;

        allEvents?.forEach((e: any) => {
            totalRuns += (e.runs_off_bat || 0) + (e.extras || 0);
            if (e.is_wicket) totalWickets++;
            if (e.extra_type !== 'wide' && e.extra_type !== 'nb') legalBalls++;
        });

        const overs = Math.floor(legalBalls / 6) + ((legalBalls % 6) / 10);

        await supabase.from('innings').update({
            runs: totalRuns,
            wickets: totalWickets,
            overs: overs
        }).eq('id', currentInnings.id);

        fetchMatchEvents(activeMatch.id);
        const { data: refreshedInn } = await supabase.from('innings').select('*').eq('id', currentInnings.id).single();
        if (refreshedInn) setCurrentInnings(refreshedInn);
        alert('Last ball undone successfully');
    };

    const endInnings = async () => {
        if (!activeMatch || !currentInnings) {
            alert("Error: Match data not loaded correctly.");
            return;
        }

        if (!confirm('Are you sure you want to end this innings?')) return;

        try {
            if (currentInnings.innings_number === 1) {
                setFirstInningsRuns(currentInnings.runs || 0);
                
                // 1. Mark current innings as completed
                const { error: updateErr } = await supabase
                    .from('innings')
                    .update({ is_completed: true })
                    .eq('id', currentInnings.id);

                if (updateErr) {
                    console.error('FINISH_INN1_ERROR:', updateErr);
                    alert(`Database Error finishing innings: ${updateErr.message}`);
                    return;
                }

                // 2. Insert 2nd innings
                const { data: inn2, error: insertErr } = await supabase.from('innings').insert([{
                    match_id: activeMatch.id,
                    innings_number: 2,
                    batting_team_id: currentInnings.bowling_team_id,
                    bowling_team_id: currentInnings.batting_team_id,
                    runs: 0,
                    wickets: 0,
                    overs: 0.0
                }]).select().single();

                if (insertErr) {
                    console.error('START_INN2_ERROR:', insertErr);
                    alert(`Database Error starting 2nd innings: ${insertErr.message}`);
                } else {
                    setCurrentInnings(inn2);
                    alert('1st Innings Completed! Starting 2nd Innings...');
                }
            } else {
                // ... logic for match completion
                const { data: inn1, error: e1 } = await supabase.from('innings').select('runs').eq('match_id', activeMatch.id).eq('innings_number', 1).single();
                const { data: inn2, error: e2 } = await supabase.from('innings').select('runs').eq('match_id', activeMatch.id).eq('innings_number', 2).single();

                if (e1 || e2) {
                    alert("Error fetching innings data to calculate winner.");
                    return;
                }

                let matchWinnerId = null;
                let resultMessage = 'Match Completed!';

                if (inn1 && inn2) {
                    if (inn2.runs > inn1.runs) {
                        matchWinnerId = currentInnings.batting_team_id;
                        resultMessage = `🏆 ${getTeamName(matchWinnerId)} won by ${10 - (currentInnings.wickets || 0)} wickets!`;
                    } else if (inn1.runs > inn2.runs) {
                        matchWinnerId = currentInnings.bowling_team_id;
                        resultMessage = `🏆 ${getTeamName(matchWinnerId)} won by ${inn1.runs - inn2.runs} runs!`;
                    } else {
                        resultMessage = "🤝 Match Tied!";
                    }
                }

                // Update Match Status
                const { error: matchErr } = await supabase.from('matches').update({
                    status: 'completed',
                    winner_team_id: matchWinnerId
                }).eq('id', activeMatch.id);

                if (matchErr) {
                    alert(`Error finalizing match: ${matchErr.message}`);
                    return;
                }

                // Mark 2nd innings as completed
                await supabase.from('innings').update({ is_completed: true }).eq('id', currentInnings.id);

                alert(resultMessage);
                await fetchMatches();
                setView('matches');
            }
        } catch (err: any) {
            console.error('END_INNINGS_CRITICAL_ERROR:', err);
            alert(`A critical error occurred: ${err.message}`);
        }
    };

    const downloadReport = async (match: any) => {
        const { data: stats } = await supabase.from('player_match_stats').select('*, players(*)').eq('match_id', match.id);
        const { data: teamA } = await supabase.from('teams').select('name').eq('id', match.team_a_id).single();
        const { data: teamB } = await supabase.from('teams').select('name').eq('id', match.team_b_id).single();
        const { data: tossWinner } = await supabase.from('teams').select('name').eq('id', match.toss_winner_id).single();
        const { data: matchWinner } = await supabase.from('teams').select('name').eq('id', match.winner_team_id).single();

        if (!stats) return;

        let csv = 'Team Name,Player Name,Runs Scored,Wickets Taken,Overs Bowled,Batting Order,Bowling Order,Toss Winner,Toss Decision,Match Winner\n';

        stats.forEach((s: any) => {
            const teamName = s.team_id === match.team_a_id ? teamA?.name : teamB?.name;
            csv += `${teamName},${s.players?.first_name} ${s.players?.last_name},${s.runs_scored},${s.wickets_taken},${s.overs_bowled},${s.batting_order || ''},${s.bowling_order || ''},${tossWinner?.name || ''},${match.toss_decision || ''},${matchWinner?.name || ''}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Match_Report_${match.match_name.replace(/\s+/g, '_')}.csv`;
        a.click();
    };

    // --- RENDERERS ---

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity className="rotate" size={40} color="var(--primary)" />
        </div>
    );

    return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
            <Navbar />

            <div className="container-responsive" style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto' }}>

                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 950 }}>
                            {view === 'matches' && <>Tournament <span style={{ color: 'var(--primary)' }}>Center</span></>}
                            {view === 'create' && <>Setup <span style={{ color: 'var(--primary)' }}>Match</span></>}
                            {view === 'squad' && <>Select <span style={{ color: 'var(--primary)' }}>Playing XI</span></>}
                            {view === 'toss' && <>Match <span style={{ color: 'var(--primary)' }}>Toss</span></>}
                            {view === 'scoring' && <>Live <span style={{ color: 'var(--primary)' }}>Scoring Console</span></>}
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Manage tournament matches and real-time scores</p>
                    </div>
                    {view !== 'matches' && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <a href="/scoreboard" target="_blank" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 255, 128, 0.1)', borderColor: '#00ff80', color: '#00ff80', textDecoration: 'none', fontSize: '0.8rem' }}>
                                <Zap size={18} /> LIVE PUBLIC LINK
                            </a>
                            <button onClick={fetchTournamentStats} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCw size={18} /> REFRESH
                            </button>
                            <button onClick={() => setView('matches')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ChevronLeft size={18} /> EXIT CONSOLE
                            </button>
                        </div>
                    )}
                </div>

                {/* Top Statistics Bar */}
                {view === 'matches' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
                        <div className="glass" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center' }}>
                            <Trophy size={24} color="var(--primary)" style={{ marginBottom: '10px' }} />
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)' }}>BEST BATSMAN</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{tournamentStats[0]?.first_name || '---'} ({tournamentStats[0]?.total_runs || 0} Runs)</div>
                        </div>
                        <div className="glass" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center', border: '1px solid rgba(0, 255, 128, 0.2)' }}>
                            <Target size={24} color="#00ff80" style={{ marginBottom: '10px' }} />
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>BEST BOWLER</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#00ff80' }}>
                                {(() => {
                                    const best = [...tournamentStats].sort((a, b) => b.total_wickets - a.total_wickets)[0];
                                    return best ? `${best.first_name} (${best.total_wickets} Wkts)` : '---';
                                })()}
                            </div>
                        </div>
                        <div className="glass" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center', border: '1px solid var(--primary)' }}>
                            <Zap size={24} color="#ffd700" style={{ marginBottom: '10px' }} />
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PLAYER OF TOURNAMENT</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)' }}>
                                {(() => {
                                    const best = [...tournamentStats].sort((a, b) => b.pot_score - a.pot_score)[0];
                                    return best ? `${best.first_name}` : '---';
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {view === 'matches' && (
                        <motion.div key="matches" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginBottom: '20px' }}>
                                <button onClick={() => setView('stats')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 30px' }}>
                                    <Trophy size={20} /> FULL STATISTICS
                                </button>
                                <button onClick={() => setView('create')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 30px' }}>
                                    <Plus size={20} /> CREATE MATCH
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '25px' }}>
                                {matches.map(m => (
                                    <div key={m.id} className="glass" style={{ padding: '30px', borderRadius: '25px', border: '1px solid var(--border)', position: 'relative' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                            <div>
                                                <div style={{ color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>{m.match_type}</div>
                                                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: '5px' }}>{m.match_name}</h3>
                                            </div>
                                            <div style={{ padding: '6px 12px', borderRadius: '8px', background: m.status === 'live' ? 'rgba(0, 255, 128, 0.1)' : 'rgba(255,255,255,0.05)', color: m.status === 'live' ? '#00ff80' : 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 900 }}>
                                                {m.status.toUpperCase()}
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '20px', margin: '20px 0' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{m.team_a?.name || 'TBD'}</div>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-muted)' }}>VS</div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{m.team_b?.name || 'TBD'}</div>
                                            </div>
                                        </div>

                                        {m.status === 'completed' && (
                                            <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(0, 255, 128, 0.05)', borderRadius: '12px', border: '1px solid rgba(0, 255, 128, 0.2)', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.65rem', color: '#00ff80', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Match Result</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fff' }}>
                                                    {m.winner_team_id ? `${getTeamName(m.winner_team_id)} WON THE MATCH` : 'MATCH TIED'}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button onClick={() => handleContinueMatch(m)} className="btn-primary" style={{ flex: 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <Activity size={16} /> {m.status === 'live' ? 'CONTINUE' : 'CONTINUE'}
                                            </button>
                                            <button onClick={() => downloadReport(m)} className="btn-secondary" style={{ flex: 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--primary)', color: 'var(--primary)' }}>
                                                <Download size={16} /> REPORT
                                            </button>
                                            <button
                                                onClick={() => handleDeleteMatch(m.id)}
                                                className="btn-secondary"
                                                style={{ width: '40px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                title="Emergency Delete Match"
                                            >
                                                <Trash2 size={16} color="#ff4b4b" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {view === 'stats' && (
                        <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className="glass" style={{ padding: '40px', borderRadius: '30px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                                    <h2 style={{ fontWeight: 950 }}>TOURNAMENT <span style={{ color: 'var(--primary)' }}>LEADERBOARD</span></h2>
                                    <button onClick={() => setView('matches')} className="btn-secondary">BACK TO MATCHES</button>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                                <th style={{ padding: '20px' }}>PLAYER</th>
                                                <th style={{ padding: '20px' }}>ROLE</th>
                                                <th style={{ padding: '20px' }}>RUNS</th>
                                                <th style={{ padding: '20px' }}>WICKETS</th>
                                                <th style={{ padding: '20px' }}>POT SCORE</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tournamentStats.map((s: any) => (
                                                <tr key={s.player_id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#222', overflow: 'hidden' }}>
                                                            <img src={fixPhotoUrl(s.photo_url, s.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.first_name}`; }} />
                                                        </div>
                                                        <span style={{ fontWeight: 800 }}>{s.first_name} {s.last_name}</span>
                                                    </td>
                                                    <td style={{ padding: '15px 20px', color: 'var(--text-muted)' }}>{s.role}</td>
                                                    <td style={{ padding: '15px 20px', fontWeight: 900 }}>{s.total_runs}</td>
                                                    <td style={{ padding: '15px 20px', fontWeight: 900, color: '#00ff80' }}>{s.total_wickets}</td>
                                                    <td style={{ padding: '15px 20px', fontWeight: 900, color: 'var(--primary)' }}>{Math.round(s.pot_score)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {view === 'create' && (
                        <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <div className="glass" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px', borderRadius: '30px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '25px' }}>
                                    <div>
                                        <label style={labelStyle}>MATCH NAME</label>
                                        <input style={inputStyle} placeholder="e.g. League Match 1" value={formData.match_name} onChange={e => setFormData({ ...formData, match_name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>MATCH TYPE</label>
                                        <select style={inputStyle} value={formData.match_type} onChange={e => setFormData({ ...formData, match_type: e.target.value })}>
                                            <option>League Match</option>
                                            <option>Semi Final</option>
                                            <option>Final</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '25px' }}>
                                    <label style={labelStyle}>OVERS PER INNINGS</label>
                                    <select style={inputStyle} value={formData.max_overs} onChange={e => setFormData({ ...formData, max_overs: e.target.value })}>
                                        <option value="5">5 Overs</option>
                                        <option value="8">8 Overs</option>
                                        <option value="10">10 Overs</option>
                                        <option value="12">12 Overs</option>
                                        <option value="15">15 Overs</option>
                                        <option value="20">20 Overs</option>
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '25px' }}>
                                    <div>
                                        <label style={labelStyle}>TEAM A</label>
                                        <select style={inputStyle} value={formData.team_a_id} onChange={e => setFormData({ ...formData, team_a_id: e.target.value })}>
                                            <option value="" style={optionStyle}>Select Team</option>
                                            {teams.map(t => <option key={t.id} value={t.id} style={optionStyle}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>TEAM B</label>
                                        <select style={inputStyle} value={formData.team_b_id} onChange={e => setFormData({ ...formData, team_b_id: e.target.value })}>
                                            <option value="" style={optionStyle}>Select Team</option>
                                            {teams.map(t => <option key={t.id} value={t.id} style={optionStyle}>{t.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button onClick={handleCreateMatch} className="btn-primary" style={{ width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: 900 }}>
                                    INITIALIZE MATCH
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {view === 'squad' && (
                        <motion.div key="squad" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
                                {/* TEAM A Squad Selector */}
                                <div className="glass" style={{ padding: '30px', borderRadius: '25px' }}>
                                    <h3 style={{ marginBottom: '20px', fontWeight: 900, textTransform: 'uppercase' }}>
                                        {getTeamName(activeMatch?.team_a_id)} ROSTER ({selectedSquadA.length})
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
                                        {teamAPlayers.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No players found for this team.</div>}
                                        {teamAPlayers.map(p => (
                                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: selectedSquadA.includes(p.id) ? 'rgba(0, 255, 128, 0.1)' : 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px solid', borderColor: selectedSquadA.includes(p.id) ? '#00ff80' : 'var(--border)', cursor: 'pointer' }}>
                                                <input type="checkbox" style={{ display: 'none' }} checked={selectedSquadA.includes(p.id)} onChange={e => {
                                                    if (e.target.checked) setSelectedSquadA([...selectedSquadA, p.id]);
                                                    else setSelectedSquadA(selectedSquadA.filter(id => id !== p.id));
                                                }} />
                                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#222', overflow: 'hidden' }}>
                                                    <img
                                                        src={fixPhotoUrl(p.photo_url, p.first_name)}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        alt=""
                                                        referrerPolicy="no-referrer"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 800 }}>{p.first_name} {p.last_name}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{p.role}</div>
                                                </div>
                                                {selectedSquadA.includes(p.id) && <UserCheck size={20} color="#00ff80" />}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                {/* TEAM B Squad Selector */}
                                <div className="glass" style={{ padding: '30px', borderRadius: '25px' }}>
                                    <h3 style={{ marginBottom: '20px', fontWeight: 900, textTransform: 'uppercase' }}>
                                        {getTeamName(activeMatch?.team_b_id)} ROSTER ({selectedSquadB.length})
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
                                        {teamBPlayers.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No players found for this team.</div>}
                                        {teamBPlayers.map(p => (
                                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: selectedSquadB.includes(p.id) ? 'rgba(0, 255, 128, 0.1)' : 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px solid', borderColor: selectedSquadB.includes(p.id) ? '#00ff80' : 'var(--border)', cursor: 'pointer' }}>
                                                <input type="checkbox" style={{ display: 'none' }} checked={selectedSquadB.includes(p.id)} onChange={e => {
                                                    if (e.target.checked) setSelectedSquadB([...selectedSquadB, p.id]);
                                                    else setSelectedSquadB(selectedSquadB.filter(id => id !== p.id));
                                                }} />
                                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#222', overflow: 'hidden' }}>
                                                    <img
                                                        src={fixPhotoUrl(p.photo_url, p.first_name)}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        alt=""
                                                        referrerPolicy="no-referrer"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 800 }}>{p.first_name} {p.last_name}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{p.role}</div>
                                                </div>
                                                {selectedSquadB.includes(p.id) && <UserCheck size={20} color="#00ff80" />}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleSaveSquad} className="btn-primary" style={{ width: '100%', padding: '20px', fontWeight: 950 }}>
                                SAVE SQUADS & PROCEED TO TOSS
                            </button>
                        </motion.div>
                    )}

                    {view === 'toss' && (
                        <motion.div key="toss" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                            <div className="glass" style={{ maxWidth: '600px', margin: '0 auto', padding: '50px', borderRadius: '35px', textAlign: 'center' }}>
                                <Trophy size={60} color="var(--primary)" style={{ marginBottom: '30px' }} />
                                <h2 style={{ fontSize: '1.8rem', fontWeight: 950, marginBottom: '40px' }}>Toss Verification</h2>

                                <div style={{ marginBottom: '35px' }}>
                                    <label style={labelStyle}>WHO WON THE TOSS?</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <button
                                            onClick={() => setTossData({ ...tossData, toss_winner_id: activeMatch.team_a_id })}
                                            className={tossData.toss_winner_id === activeMatch.team_a_id ? 'btn-primary' : 'btn-secondary'}
                                            style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 900 }}
                                        >
                                            {getTeamName(activeMatch.team_a_id)}
                                        </button>
                                        <button
                                            onClick={() => setTossData({ ...tossData, toss_winner_id: activeMatch.team_b_id })}
                                            className={tossData.toss_winner_id === activeMatch.team_b_id ? 'btn-primary' : 'btn-secondary'}
                                            style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 900 }}
                                        >
                                            {getTeamName(activeMatch.team_b_id)}
                                        </button>
                                    </div>
                                </div>

                                {tossData.toss_winner_id && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '40px' }}>
                                        <label style={labelStyle}>{getTeamName(tossData.toss_winner_id)} CHOSE TO:</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                            <button
                                                onClick={() => setTossData({ ...tossData, toss_decision: 'Batting' })}
                                                className={tossData.toss_decision === 'Batting' ? 'btn-primary' : 'btn-secondary'}
                                                style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 900 }}
                                            >
                                                BAT
                                            </button>
                                            <button
                                                onClick={() => setTossData({ ...tossData, toss_decision: 'Bowling' })}
                                                className={tossData.toss_decision === 'Bowling' ? 'btn-primary' : 'btn-secondary'}
                                                style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 900 }}
                                            >
                                                BOWL
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                <button 
                                    disabled={!tossData.toss_winner_id || !tossData.toss_decision}
                                    onClick={handleSaveToss} 
                                    className="btn-primary" 
                                    style={{ width: '100%', padding: '20px', fontSize: '1.2rem', fontWeight: 950, boxShadow: tossData.toss_decision ? '0 0 30px var(--primary-glow)' : 'none', opacity: (tossData.toss_winner_id && tossData.toss_decision) ? 1 : 0.5 }}
                                >
                                    START LIVE SCORING
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {view === 'scoring' && currentInnings && (
                        <motion.div key="scoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {/* Team Switcher */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', maxWidth: '800px', margin: '0 auto 20px auto' }}>
                                <button
                                    onClick={() => setScoringTab('team_a')}
                                    className={scoringTab === 'team_a' ? 'btn-primary' : 'btn-secondary'}
                                    style={{ padding: '15px 5px', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}
                                >
                                    {getTeamName(activeMatch?.team_a_id)}
                                </button>
                                <button
                                    onClick={() => setScoringTab('team_b')}
                                    className={scoringTab === 'team_b' ? 'btn-primary' : 'btn-secondary'}
                                    style={{ padding: '15px 5px', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}
                                >
                                    {getTeamName(activeMatch?.team_b_id)}
                                </button>
                                <button
                                    onClick={() => setScoringTab('live')}
                                    disabled={activeMatch.status === 'completed'}
                                    className={scoringTab === 'live' ? 'btn-primary' : 'btn-secondary'}
                                    style={{ padding: '15px 5px', fontSize: '0.75rem', fontWeight: 900, opacity: activeMatch.status === 'completed' ? 0.3 : 1 }}
                                >
                                    LIVE SCORING
                                </button>
                            </div>

                            {scoringTab === 'live' && (
                                <div className="glass shadow-premium" style={{ padding: '30px', borderRadius: '35px', maxWidth: '800px', margin: '0 auto' }}>
                                    {/* Score Indicator */}
                                <div className="mobile-score-container" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '30px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '25px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>{getTeamName(currentInnings?.batting_team_id)}</div>
                                        <div className="score-text" style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 950, lineHeight: 1 }}>
                                            {currentInnings?.runs || 0} - {currentInnings?.wickets || 0}
                                        </div>
                                    </div>
                                    <div style={{ width: '2px', height: '60px', background: 'var(--border)', margin: '0 15px' }} />
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>OVERS</div>
                                        <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 950 }}>
                                            {(currentInnings?.overs || 0).toFixed(1)} <span style={{ fontSize: 'min(1rem, 3vw)', color: 'var(--text-muted)' }}>/ {activeMatch?.max_overs || 8}</span>
                                        </div>
                                    </div>
                                </div>

                                {currentInnings.innings_number === 2 && firstInningsRuns !== null && (
                                    <div style={{ textAlign: 'center', marginBottom: '20px', padding: '15px', background: 'rgba(0,255,128,0.1)', borderRadius: '25px', border: '1px solid rgba(0,255,128,0.2)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: 'rgba(0,255,128,0.7)', fontWeight: 900, textTransform: 'uppercase' }}>Runs Required</div>
                                                <div style={{ color: '#00ff80', fontWeight: 950, fontSize: '2rem' }}>
                                                    {Math.max(0, (firstInningsRuns + 1) - (currentInnings.runs || 0))}
                                                </div>
                                            </div>
                                            <div style={{ borderLeft: '1px solid rgba(0,255,128,0.2)' }}>
                                                <div style={{ fontSize: '0.7rem', color: 'rgba(0,255,128,0.7)', fontWeight: 900, textTransform: 'uppercase' }}>Balls Remaining</div>
                                                <div style={{ color: '#00ff80', fontWeight: 950, fontSize: '2rem' }}>
                                                    {(() => {
                                                        const totalBalls = (activeMatch?.max_overs || 8) * 6;
                                                        const currentOvers = currentInnings.overs || 0;
                                                        const ballsBowled = Math.floor(currentOvers) * 6 + Math.round((currentOvers - Math.floor(currentOvers)) * 10);
                                                        return Math.max(0, totalBalls - ballsBowled);
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '10px', fontSize: '0.85rem', fontWeight: 800, color: '#00ff80' }}>
                                            TARGET: {firstInningsRuns + 1}
                                        </div>
                                    </div>
                                )}

                                {/* Striker & Bowler Selection */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                                    <div>
                                        <label style={labelStyle}>STRIKER</label>
                                        <select style={inputStyle} value={strikerId} onChange={e => setStrikerId(e.target.value)}>
                                            <option value="">Select Striker</option>
                                            {(currentInnings.batting_team_id === activeMatch.team_a_id ? matchPlayersA : matchPlayersB).map(p => (
                                                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>CURRENT BOWLER</label>
                                        <select style={inputStyle} value={bowlerId} onChange={e => setBowlerId(e.target.value)}>
                                            <option value="">Select Bowler</option>
                                            {(currentInnings.bowling_team_id === activeMatch.team_a_id ? matchPlayersA : matchPlayersB).map(p => (
                                                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Run Buttons */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
                                    {[0, 4, 6].map(runs => (
                                        <button 
                                            key={runs} 
                                            onClick={() => recordBall(runs)} 
                                            className="btn-secondary" 
                                            style={{ padding: '30px 0', fontSize: '2.5rem', fontWeight: 950, borderRadius: '25px', background: runs === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,215,0,0.1)', borderColor: runs === 0 ? 'var(--border)' : 'var(--primary)' }}
                                        >
                                            {runs}
                                        </button>
                                    ))}
                                </div>

                                {/* Extras & Actions */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                    <button onClick={() => recordBall(0, false, 'wide')} className="btn-secondary" style={{ padding: '20px', fontSize: '1.1rem', fontWeight: 900, borderRadius: '20px', color: '#ffd700', borderColor: '#ffd700' }}>WIDE</button>
                                    <button onClick={() => recordBall(0, false, 'nb')} className="btn-secondary" style={{ padding: '20px', fontSize: '1.1rem', fontWeight: 900, borderRadius: '20px', color: '#ffd700', borderColor: '#ffd700' }}>NO BALL</button>
                                </div>

                                <button 
                                    onClick={() => recordBall(0, true)} 
                                    className="btn-secondary" 
                                    style={{ width: '100%', padding: '25px', fontSize: '1.5rem', fontWeight: 950, borderRadius: '25px', color: '#ff4b4b', borderColor: '#ff4b4b', marginBottom: '20px', background: 'rgba(255, 75, 75, 0.1)' }}
                                >
                                    WICKET
                                </button>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                    <button 
                                        onClick={handleUndo} 
                                        className="btn-secondary" 
                                        style={{ padding: '15px', fontSize: '0.8rem', fontWeight: 900, borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                    >
                                        <RefreshCw size={14} /> UNDO
                                    </button>
                                    <button 
                                        onClick={endInnings} 
                                        className="btn-secondary" 
                                        style={{ padding: '15px', fontSize: '0.8rem', fontWeight: 900, borderRadius: '15px', borderColor: '#ff4b4b', color: '#ff4b4b' }}
                                    >
                                        END INNINGS
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const overs = currentInnings.overs || 0;
                                            const balls = Math.round((overs - Math.floor(overs)) * 10);
                                            if (balls !== 0) {
                                                if (confirm('Over is not complete. Manual End Over?')) {
                                                    const nextOver = Math.ceil(overs);
                                                    supabase.from('innings').update({ overs: nextOver }).eq('id', currentInnings.id).then(() => {
                                                        alert('New over! Please select next bowler.');
                                                        setBowlerId('');
                                                        init();
                                                    });
                                                }
                                            } else {
                                                alert('Over completed! Please select next bowler.');
                                                setBowlerId('');
                                            }
                                        }} 
                                        className="btn-secondary" 
                                        style={{ padding: '15px', fontSize: '0.8rem', fontWeight: 900, borderRadius: '15px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                    >
                                        END OVER
                                    </button>
                                </div>
                                </div>
                            )}

                            {(scoringTab === 'team_a' || scoringTab === 'team_b') && activeMatch && (
                                <MatchScorecard 
                                    teamId={scoringTab === 'team_a' ? activeMatch.team_a_id : activeMatch.team_b_id}
                                    teamName={getTeamName(scoringTab === 'team_a' ? activeMatch.team_a_id : activeMatch.team_b_id)}
                                    events={matchEvents}
                                    match={activeMatch}
                                />
                            )}
                        </motion.div>
                    )}

                    {/* Wicket Modal */}
                    {showWicketModal && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
                            <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '40px', borderRadius: '30px' }}>
                                <h2 style={{ marginBottom: '30px', fontWeight: 950 }}>WICKET DETAILS</h2>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={labelStyle}>DISMISSED BATSMAN</label>
                                    <div style={inputStyle}>
                                        {getTeamName(currentInnings.batting_team_id === activeMatch.team_a_id ? activeMatch.team_a_id : activeMatch.team_b_id)}: { 
                                            (matchPlayersA.find(p => p.id === strikerId) || matchPlayersB.find(p => p.id === strikerId))?.first_name 
                                        } { 
                                            (matchPlayersA.find(p => p.id === strikerId) || matchPlayersB.find(p => p.id === strikerId))?.last_name 
                                        } (Striker)
                                    </div>
                                </div>
                                <div style={{ marginBottom: '30px' }}>
                                    <label style={labelStyle}>WICKET TYPE</label>
                                    <select style={inputStyle} value={selectedWicketType} onChange={(e: any) => setSelectedWicketType(e.target.value)}>
                                        <option>Bowled</option>
                                        <option>Caught</option>
                                        <option>LBW</option>
                                        <option>Run Out</option>
                                        <option>Stumped</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <button onClick={() => setShowWicketModal(false)} className="btn-secondary" style={{ flex: 1 }}>CANCEL</button>
                                    <button onClick={() => recordBall(0, true)} className="btn-primary" style={{ flex: 2 }}>CONFIRM WICKET</button>
                                </div>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            <style jsx>{`
                .btn-primary { background: var(--primary); color: #000; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 800; cursor: pointer; transition: all 0.3s ease; }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px var(--primary-glow); }
                .btn-secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid var(--border); padding: 12px 20px; border-radius: 12px; font-weight: 800; cursor: pointer; transition: all 0.3s ease; }
                .btn-secondary:hover { background: rgba(255,255,255,0.1); }
                .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid var(--border); }
                .rotate { animation: rotate 2s linear infinite; }
                @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                @media (max-width: 600px) {
                    .mobile-score-container { padding: 15px !important; }
                    .score-text { font-size: 3rem !important; }
                    .btn-secondary { padding: 15px !important; font-size: 1.5rem !important; }
                }
            `}</style>
        </main>
    );
}

const labelStyle = { fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '10px', display: 'block', letterSpacing: '1px' };
const inputStyle = { width: '100%', padding: '15px', background: '#111', border: '1px solid var(--border)', borderRadius: '15px', color: '#fff', outline: 'none', fontSize: '1rem', fontWeight: 600, appearance: 'none' as const };
const optionStyle = { background: '#111', color: '#fff', padding: '10px' };
