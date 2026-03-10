'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import {
    Plus, Trash2, Zap, Save, RefreshCw, Trophy,
    ChevronRight, UserCheck, Shield, Gavel,
    Swords, LayoutGrid, FileText, ChevronLeft,
    UserPlus, Activity, Target, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RoleGuard from '@/components/RoleGuard';
import { fixPhotoUrl } from '@/lib/utils';

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
        venue: 'Main Stadium'
    });

    const [tossData, setTossData] = useState({
        toss_winner_id: '',
        toss_decision: 'Batting'
    });

    // Scoring State
    const [currentInnings, setCurrentInnings] = useState<any>(null);
    const [strikerId, setStrikerId] = useState('');
    const [nonStrikerId, setNonStrikerId] = useState('');
    const [bowlerId, setBowlerId] = useState('');
    const [selectedWicketType, setSelectedWicketType] = useState('Caught');
    const [dismissedId, setDismissedId] = useState('');
    const [wicketTakerId, setWicketTakerId] = useState('');
    const [showWicketModal, setShowWicketModal] = useState(false);

    // Stats State
    const [tournamentStats, setTournamentStats] = useState<any[]>([]);

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
        if (!tossData.toss_winner_id) {
            alert('Please select toss winner');
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
                await fetchMatchSquad(activeMatch.id);
                setView('scoring');
            }
        }
    };

    const fetchMatchSquad = async (matchId: string) => {
        const { data } = await supabase.from('match_players').select('*, players(*)').eq('match_id', matchId);
        if (data) {
            setMatchPlayersA(data.filter((p: any) => p.team_id === activeMatch.team_a_id).map((p: any) => p.players));
            setMatchPlayersB(data.filter((p: any) => p.team_id === activeMatch.team_b_id).map((p: any) => p.players));
        }
    };

    // --- SCORING ACTIONS ---

    const incrementOver = (current: number) => {
        let overs = Math.floor(current);
        let balls = Math.round((current - overs) * 10);
        balls++;
        if (balls >= 6) {
            overs++;
            balls = 0;
        }
        return overs + (balls / 10);
    };

    const recordBall = async (runs: number, isWicket: boolean = false, extraType: 'none' | 'wide' | 'nb' | 'bye' | 'lb' = 'none') => {
        if (!strikerId || !bowlerId || !currentInnings) {
            alert('Please select striker and bowler');
            return;
        }

        if (isWicket && !showWicketModal) {
            setDismissedId(strikerId);
            setWicketTakerId(bowlerId);
            setShowWicketModal(true);
            return;
        }

        const isLegalBall = extraType === 'none' || extraType === 'bye' || extraType === 'lb';
        const nextOver = isLegalBall ? incrementOver(currentInnings.overs || 0) : (currentInnings.overs || 0);

        const extraRuns = (extraType === 'wide' || extraType === 'nb') ? 1 : 0;
        const totalBallRuns = runs + extraRuns;

        // 1. Update Innings
        const { error: innErr } = await supabase.from('innings').update({
            runs: (currentInnings.runs || 0) + totalBallRuns,
            wickets: (currentInnings.wickets || 0) + (isWicket ? 1 : 0),
            overs: nextOver
        }).eq('id', currentInnings.id);

        if (innErr) { alert('Error updating scoreboard'); return; }

        // 2. Record Event
        await supabase.from('match_events').insert([{
            match_id: activeMatch.id,
            innings_number: currentInnings.innings_number,
            striker_id: strikerId,
            non_striker_id: nonStrikerId || null,
            bowler_id: bowlerId,
            runs_off_bat: (extraType === 'none' || extraType === 'nb') ? runs : 0,
            extras: (extraType !== 'none' ? (extraType === 'wide' || extraType === 'nb' ? 1 + runs : runs) : 0),
            extra_type: extraType !== 'none' ? extraType : null,
            is_wicket: isWicket,
            wicket_type: isWicket ? selectedWicketType : null,
            dismissed_player_id: isWicket ? dismissedId : null,
            over_number: Math.floor(nextOver),
            ball_number: isLegalBall ? (Math.round((nextOver - Math.floor(nextOver)) * 10) || 6) : (Math.round((currentInnings.overs - Math.floor(currentInnings.overs)) * 10))
        }]);

        // 3. Update Player Match Stats (Striker)
        if (extraType !== 'wide') {
            const { data: strikerStats } = await supabase.from('player_match_stats').select('*').eq('match_id', activeMatch.id).eq('player_id', strikerId).maybeSingle();
            const batRuns = (extraType === 'none' || extraType === 'nb') ? runs : 0;
            const ballFaced = extraType === 'nb' ? 0 : 1;

            if (strikerStats) {
                await supabase.from('player_match_stats').update({
                    runs_scored: strikerStats.runs_scored + batRuns,
                    balls_faced: strikerStats.balls_faced + ballFaced,
                    fours: strikerStats.fours + (batRuns === 4 ? 1 : 0),
                    sixes: strikerStats.sixes + (batRuns === 6 ? 1 : 0)
                }).eq('match_id', activeMatch.id).eq('player_id', strikerId);
            } else {
                await supabase.from('player_match_stats').insert([{
                    match_id: activeMatch.id,
                    player_id: strikerId,
                    team_id: currentInnings.batting_team_id,
                    runs_scored: batRuns,
                    balls_faced: ballFaced,
                    fours: batRuns === 4 ? 1 : 0,
                    sixes: batRuns === 6 ? 1 : 0
                }]);
            }
        }

        // 4. Update Player Match Stats (Bowler)
        const { data: bowlerStats } = await supabase.from('player_match_stats').select('*').eq('match_id', activeMatch.id).eq('player_id', bowlerId).maybeSingle();
        const runsConceded = (extraType === 'wide' || extraType === 'nb') ? 1 + runs : (extraType === 'none' ? runs : 0);

        if (bowlerStats) {
            await supabase.from('player_match_stats').update({
                runs_conceded: bowlerStats.runs_conceded + runsConceded,
                overs_bowled: isLegalBall ? incrementOver(bowlerStats.overs_bowled || 0) : (bowlerStats.overs_bowled || 0),
                wickets_taken: bowlerStats.wickets_taken + (isWicket ? 1 : 0)
            }).eq('match_id', activeMatch.id).eq('player_id', bowlerId);
        } else {
            await supabase.from('player_match_stats').insert([{
                match_id: activeMatch.id,
                player_id: bowlerId,
                team_id: currentInnings.bowling_team_id,
                runs_conceded: runsConceded,
                overs_bowled: isLegalBall ? 0.1 : 0.0,
                wickets_taken: isWicket ? 1 : 0
            }]);
        }

        const { data: refreshedInn } = await supabase.from('innings').select('*').eq('id', currentInnings.id).single();
        if (refreshedInn) setCurrentInnings(refreshedInn);
        if (isWicket) {
            setShowWicketModal(false);
            setStrikerId('');
        }
    };

    const endInnings = async () => {
        if (!confirm('Are you sure you want to end this innings?')) return;

        if (currentInnings.innings_number === 1) {
            const { data: inn2, error } = await supabase.from('innings').insert([{
                match_id: activeMatch.id,
                innings_number: 2,
                batting_team_id: currentInnings.bowling_team_id,
                bowling_team_id: currentInnings.batting_team_id
            }]).select().single();

            if (error) alert('Error starting 2nd innings');
            else {
                setCurrentInnings(inn2);
                alert('1st Innings Completed! Starting 2nd Innings...');
            }
        } else {
            const { data: winnerId } = await supabase.from('innings')
                .select('batting_team_id, runs')
                .eq('match_id', activeMatch.id)
                .order('innings_number', { ascending: false });

            // Calculate winner (simple logic)
            // In a real app we'd compare inn1 and inn2
            const { data: inn1 } = await supabase.from('innings').select('runs').eq('match_id', activeMatch.id).eq('innings_number', 1).single();
            const { data: inn2 } = await supabase.from('innings').select('runs').eq('match_id', activeMatch.id).eq('innings_number', 2).single();

            let matchWinnerId = null;
            if (inn1 && inn2) {
                if (inn1.runs > inn2.runs) matchWinnerId = activeMatch.batting_first_id;
                else if (inn2.runs > inn1.runs) matchWinnerId = activeMatch.batting_first_id === activeMatch.team_a_id ? activeMatch.team_b_id : activeMatch.team_a_id;
            }

            await supabase.from('matches').update({
                status: 'completed',
                winner_team_id: matchWinnerId
            }).eq('id', activeMatch.id);

            alert('Match Completed!');
            await fetchMatches();
            setView('matches');
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
                        <div className="glass" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center' }}>
                            <Target size={24} color="#00ff80" style={{ marginBottom: '10px' }} />
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)' }}>BEST BOWLER</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>
                                {tournamentStats.sort((a, b) => b.total_wickets - a.total_wickets)[0]?.first_name || '---'}
                                ({tournamentStats.sort((a, b) => b.total_wickets - a.total_wickets)[0]?.total_wickets || 0} Wickets)
                            </div>
                        </div>
                        <div className="glass" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center' }}>
                            <Zap size={24} color="#ffd700" style={{ marginBottom: '10px' }} />
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)' }}>PLAYER OF TOURNAMENT</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{tournamentStats.sort((a, b) => b.pot_score - a.pot_score)[0]?.first_name || '---'}</div>
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

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '20px', margin: '25px 0' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{m.team_a?.name || 'TBD'}</div>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-muted)' }}>VS</div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{m.team_b?.name || 'TBD'}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button onClick={() => { setActiveMatch(m); setView('scoring'); }} className="btn-primary" style={{ flex: 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <Activity size={16} /> {m.status === 'live' ? 'CONTINUE' : 'VIEW'}
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
                                                            <img src={s.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.first_name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
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
                                        {teams.find(t => t.id === activeMatch.team_a_id)?.name || 'Team A'} ROSTER ({selectedSquadA.length})
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
                                                        src={fixPhotoUrl(p.photo_url) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        alt=""
                                                        referrerPolicy="no-referrer"
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
                                        {teams.find(t => t.id === activeMatch.team_b_id)?.name || 'Team B'} ROSTER ({selectedSquadB.length})
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
                                                        src={fixPhotoUrl(p.photo_url) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        alt=""
                                                        referrerPolicy="no-referrer"
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
                                            style={{ padding: '20px' }}
                                        >
                                            {activeMatch.team_a?.name || 'TEAM A'}
                                        </button>
                                        <button
                                            onClick={() => setTossData({ ...tossData, toss_winner_id: activeMatch.team_b_id })}
                                            className={tossData.toss_winner_id === activeMatch.team_b_id ? 'btn-primary' : 'btn-secondary'}
                                            style={{ padding: '20px' }}
                                        >
                                            {activeMatch.team_b?.name || 'TEAM B'}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '40px' }}>
                                    <label style={labelStyle}>TOSS DECISION</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <button
                                            onClick={() => setTossData({ ...tossData, toss_decision: 'Batting' })}
                                            className={tossData.toss_decision === 'Batting' ? 'btn-primary' : 'btn-secondary'}
                                            style={{ padding: '20px' }}
                                        >
                                            CHOSE BATTING
                                        </button>
                                        <button
                                            onClick={() => setTossData({ ...tossData, toss_decision: 'Bowling' })}
                                            className={tossData.toss_decision === 'Bowling' ? 'btn-primary' : 'btn-secondary'}
                                            style={{ padding: '20px' }}
                                        >
                                            CHOSE BOWLING
                                        </button>
                                    </div>
                                </div>

                                <button onClick={handleSaveToss} className="btn-primary" style={{ width: '100%', padding: '20px', fontSize: '1.2rem', fontWeight: 950, boxShadow: '0 0 30px var(--primary-glow)' }}>
                                    START LIVE SCORING
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {view === 'scoring' && currentInnings && (
                        <motion.div key="scoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className="glass shadow-premium" style={{ padding: '40px', borderRadius: '35px' }}>
                                {/* Score Indicator */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '50px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800 }}>BATTING - {currentInnings.batting_team_id === activeMatch.team_a_id ? activeMatch.team_a.name : activeMatch.team_b.name}</div>
                                        <div style={{ fontSize: '4rem', fontWeight: 950 }}>{currentInnings.runs} - {currentInnings.wickets}</div>
                                        <div style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 900 }}>OVERS: {currentInnings.overs.toFixed(1)}</div>
                                    </div>
                                    <div style={{ width: '2px', height: '100px', background: 'var(--border)' }} />
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800 }}>INNINGS</div>
                                        <div style={{ fontSize: '3rem', fontWeight: 950 }}>{currentInnings.innings_number}</div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '25px', marginBottom: '40px' }}>
                                    <div>
                                        <label style={labelStyle}>STRIKER</label>
                                        <select style={inputStyle} value={strikerId} onChange={e => setStrikerId(e.target.value)}>
                                            <option value="">Select Batsman</option>
                                            {(currentInnings.batting_team_id === activeMatch.team_a_id ? matchPlayersA : matchPlayersB).map(p => (
                                                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>NON-STRIKER</label>
                                        <select style={inputStyle} value={nonStrikerId} onChange={e => setNonStrikerId(e.target.value)}>
                                            <option value="">Select Batsman</option>
                                            {(currentInnings.batting_team_id === activeMatch.team_a_id ? matchPlayersA : matchPlayersB).map(p => (
                                                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>BOWLER</label>
                                        <select style={inputStyle} value={bowlerId} onChange={e => setBowlerId(e.target.value)}>
                                            <option value="">Select Bowler</option>
                                            {(currentInnings.bowling_team_id === activeMatch.team_a_id ? matchPlayersA : matchPlayersB).map(p => (
                                                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Scoring Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
                                    {[0, 1, 2, 3, 4, 6].map(runs => (
                                        <button key={runs} onClick={() => recordBall(runs)} className="btn-secondary" style={{ padding: '20px', fontSize: '1.8rem', fontWeight: 950, borderRadius: '20px' }}>
                                            {runs}
                                        </button>
                                    ))}
                                    <button onClick={() => recordBall(0, true)} className="btn-secondary" style={{ gridColumn: 'span 2', padding: '20px', fontSize: '1.2rem', fontWeight: 950, borderRadius: '20px', color: '#ff4b4b', borderColor: '#ff4b4b' }}>
                                        WICKET
                                    </button>
                                </div>

                                {/* Extras Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '40px' }}>
                                    <button onClick={() => recordBall(0, false, 'wide')} className="btn-secondary" style={{ padding: '15px', fontSize: '0.9rem', fontWeight: 800, borderRadius: '15px' }}>WIDE</button>
                                    <button onClick={() => recordBall(0, false, 'nb')} className="btn-secondary" style={{ padding: '15px', fontSize: '0.9rem', fontWeight: 800, borderRadius: '15px' }}>NO BALL</button>
                                    <button onClick={() => {
                                        const r = parseInt(prompt("How many leg-byes?") || "0");
                                        recordBall(r, false, 'lb');
                                    }} className="btn-secondary" style={{ padding: '15px', fontSize: '0.9rem', fontWeight: 800, borderRadius: '15px' }}>LEG BYE</button>
                                    <button onClick={() => {
                                        const r = parseInt(prompt("How many byes?") || "0");
                                        recordBall(r, false, 'bye');
                                    }} className="btn-secondary" style={{ padding: '15px', fontSize: '0.9rem', fontWeight: 800, borderRadius: '15px' }}>BYE</button>
                                </div>

                                <button onClick={endInnings} className="btn-secondary" style={{ width: '100%', padding: '15px', color: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 900 }}>
                                    END INNINGS / MATCH
                                </button>
                            </div>

                            {/* Wicket Modal */}
                            {showWicketModal && (
                                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
                                    <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '40px', borderRadius: '30px' }}>
                                        <h2 style={{ marginBottom: '30px', fontWeight: 950 }}>WICKET DETAILS</h2>
                                        <div style={{ marginBottom: '20px' }}>
                                            <label style={labelStyle}>DISMISSED BATSMAN</label>
                                            <select style={inputStyle} value={dismissedId} onChange={e => setDismissedId(e.target.value)}>
                                                <option value={strikerId}>Striker ({matchPlayersA.find(p => p.id === strikerId)?.first_name || matchPlayersB.find(p => p.id === strikerId)?.first_name})</option>
                                                <option value={nonStrikerId}>Non-Striker ({matchPlayersA.find(p => p.id === nonStrikerId)?.first_name || matchPlayersB.find(p => p.id === nonStrikerId)?.first_name})</option>
                                            </select>
                                        </div>
                                        <div style={{ marginBottom: '20px' }}>
                                            <label style={labelStyle}>WICKET TAKER (BOWLER)</label>
                                            <select style={inputStyle} value={wicketTakerId} onChange={e => setWicketTakerId(e.target.value)}>
                                                {(currentInnings.bowling_team_id === activeMatch.team_a_id ? matchPlayersA : matchPlayersB).map(p => (
                                                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name} (Bowler)</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ marginBottom: '30px' }}>
                                            <label style={labelStyle}>WICKET TYPE</label>
                                            <select style={inputStyle} value={selectedWicketType} onChange={e => setSelectedWicketType(e.target.value)}>
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
                        </motion.div>
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
            `}</style>
        </main>
    );
}

const labelStyle = { fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '10px', display: 'block', letterSpacing: '1px' };
const inputStyle = { width: '100%', padding: '15px', background: '#111', border: '1px solid var(--border)', borderRadius: '15px', color: '#fff', outline: 'none', fontSize: '1rem', fontWeight: 600, appearance: 'none' as const };
const optionStyle = { background: '#111', color: '#fff', padding: '10px' };
