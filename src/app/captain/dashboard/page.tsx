'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import RoleGuard from '@/components/RoleGuard';
import { useAuth } from '@/components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wallet,
    Users,
    Zap,
    Shield,
    Trophy,
    PieChart,
    Gavel,
    Flame,
    ArrowRight,
    TrendingUp,
    CheckCircle2
} from 'lucide-react';
import { fixPhotoUrl } from '@/lib/utils';
import { TEAM_PURSE_LIMIT, MAX_SQUAD_SIZE, getPurplePushp } from '@/lib/auction-logic';
import { playBidSound } from '@/lib/audio';
import Link from 'next/link';

export default function DashboardPage() {
    return (
        <RoleGuard allowedRole="captain">
            <CaptainDashboardContent />
        </RoleGuard>
    );
}

function CaptainDashboardContent() {
    const { user } = useAuth();
    const [team, setTeam] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [currentPlayer, setCurrentPlayer] = useState<any>(null);
    const [teamsMap, setTeamsMap] = useState<Record<string, string>>({});
    const [lastBidAlert, setLastBidAlert] = useState<any>(null);

    const teamRef = useRef<any>(null);
    const teamsMapRef = useRef<Record<string, string>>({});

    useEffect(() => {
        teamRef.current = team;
    }, [team]);

    useEffect(() => {
        teamsMapRef.current = teamsMap;
    }, [teamsMap]);

    // Fast parallel data fetch
    const fetchData = useCallback(async () => {
        if (!user) return;

        try {
            // Run teams and auction_state in parallel
            const [teamsRes, stateRes] = await Promise.all([
                supabase.from('teams').select('*'),
                supabase.from('auction_state').select('*').single()
            ]);

            const map: Record<string, string> = {};
            let myTeamData: any = null;

            if (teamsRes.data) {
                teamsRes.data.forEach((t: any) => {
                    map[t.id] = t.name;
                    if (user.user_metadata?.team_name && t.name.toLowerCase() === user.user_metadata.team_name.toLowerCase()) {
                        myTeamData = t;
                    } else if (!myTeamData && user.email && t.captain_email && t.captain_email.toLowerCase() === user.email.toLowerCase()) {
                        myTeamData = t;
                    }
                });
                setTeamsMap(map);
                teamsMapRef.current = map;
            }

            if (myTeamData) {
                setTeam(myTeamData);
                teamRef.current = myTeamData;

                // Fetch team players
                const { data: pData } = await supabase
                    .from('players')
                    .select('*')
                    .eq('team_id', myTeamData.id)
                    .eq('auction_status', 'sold')
                    .order('sold_price', { ascending: false });

                setPlayers(pData || []);
            }

            if (stateRes.data) {
                setAuctionState(stateRes.data);
                if (stateRes.data.current_player_id) {
                    supabase
                        .from('players')
                        .select('*')
                        .eq('id', stateRes.data.current_player_id)
                        .single()
                        .then(({ data }) => setCurrentPlayer(data));
                } else {
                    setCurrentPlayer(null);
                }
            }
        } catch (err) {
            console.error('Captain Dashboard Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();

        // High-efficiency Realtime channel
        const channel = supabase.channel('captain_dash_sync')
            .on('postgres_changes', { event: '*', table: 'auction_state', schema: 'public' }, (payload: any) => {
                const newState = payload.new;
                setAuctionState(newState);

                if (newState?.current_player_id) {
                    supabase
                        .from('players')
                        .select('*')
                        .eq('id', newState.current_player_id)
                        .single()
                        .then(({ data }) => setCurrentPlayer(data));
                } else {
                    setCurrentPlayer(null);
                }
            })
            .on('postgres_changes', { event: 'INSERT', table: 'bids', schema: 'public' }, (payload: any) => {
                playBidSound();
                const bTeamName = teamsMapRef.current[payload.new.team_id] || 'A Franchise';
                setLastBidAlert({
                    ...payload.new,
                    team_name: bTeamName,
                    isMyTeam: Boolean(teamRef.current && payload.new.team_id === teamRef.current.id)
                });
                setTimeout(() => setLastBidAlert(null), 4000);
            })
            .on('postgres_changes', { event: '*', table: 'teams', schema: 'public' }, (payload: any) => {
                if (teamRef.current && payload.new && payload.new.id === teamRef.current.id) {
                    setTeam(payload.new);
                }
                if (payload.new) {
                    setTeamsMap(prev => ({ ...prev, [payload.new.id]: payload.new.name }));
                }
            })
            .on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, (payload: any) => {
                const currentTeamId = teamRef.current?.id;
                if (!currentTeamId) return;

                const affectedThisTeam =
                    (payload.new && payload.new.team_id === currentTeamId) ||
                    (payload.old && payload.old.team_id === currentTeamId);

                if (affectedThisTeam) {
                    supabase
                        .from('players')
                        .select('*')
                        .eq('team_id', currentTeamId)
                        .eq('auction_status', 'sold')
                        .order('sold_price', { ascending: false })
                        .then(({ data }) => {
                            if (data) setPlayers(data);
                        });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData]);

    const squadStats = useMemo(() => {
        const getSkill = (p: any) => `${p.cricket_skill || ''} ${p.role || ''}`.toLowerCase();
        return {
            Batsman: players.filter(p => {
                const s = getSkill(p);
                return s.includes('bat') && !s.includes('all');
            }).length,
            Bowler: players.filter(p => {
                const s = getSkill(p);
                return s.includes('bowl') && !s.includes('all');
            }).length,
            'All-rounder': players.filter(p => {
                const s = getSkill(p);
                return s.includes('all') || s.includes('rounder');
            }).length,
            Wicketkeeper: players.filter(p => {
                const s = getSkill(p);
                return s.includes('keeper') || s.includes('wk');
            }).length,
        };
    }, [players]);

    const formatPushp = (amount: number) => {
        const purple = getPurplePushp(amount);
        return `${amount.toLocaleString()} Pushp${purple ? ` (${purple} Purple)` : ''}`;
    };

    if (loading) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                <Zap className="animate-spin" size={40} color="var(--primary)" />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '1px' }}>
                    LOADING FRANCHISE DASHBOARD...
                </span>
            </div>
        );
    }

    if (!team) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                <div className="glass" style={{ padding: '40px', textAlign: 'center', maxWidth: '450px', borderRadius: '24px' }}>
                    <Shield size={56} style={{ marginBottom: '16px', color: 'var(--primary)', margin: '0 auto 16px' }} />
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 900 }}>Franchise Not Found</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                        Your account is not linked to any franchise team. Please contact the administrator.
                    </p>
                    <Link href="/login" className="btn-primary" style={{ marginTop: '20px', display: 'inline-block', padding: '10px 24px', fontSize: '0.85rem' }}>
                        RE-LOGIN
                    </Link>
                </div>
            </div>
        );
    }

    const spentBudget = TEAM_PURSE_LIMIT - (team.remaining_budget ?? 0);
    const pursePercentage = Math.min(100, Math.max(0, ((team.remaining_budget ?? 0) / TEAM_PURSE_LIMIT) * 100));
    const isAuctionBidding = auctionState?.status === 'BIDDING';
    const isLeadingCurrentPlayer = Boolean(isAuctionBidding && auctionState?.highest_bid_team_id === team.id);

    return (
        <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '15px 20px 60px' }}>

            {/* LIVE BID FLOATING TOAST */}
            <AnimatePresence>
                {lastBidAlert && (
                    <motion.div
                        initial={{ y: -50, opacity: 0, scale: 0.95 }}
                        animate={{ y: 15, opacity: 1, scale: 1 }}
                        exit={{ y: -50, opacity: 0, scale: 0.95 }}
                        style={{
                            position: 'fixed',
                            top: '80px',
                            right: '25px',
                            zIndex: 9999,
                            background: lastBidAlert.isMyTeam
                                ? 'linear-gradient(135deg, rgba(0, 255, 128, 0.95), rgba(0, 180, 80, 0.95))'
                                : 'linear-gradient(135deg, rgba(255, 215, 0, 0.95), rgba(255, 140, 0, 0.95))',
                            color: '#000',
                            padding: '12px 24px',
                            borderRadius: '16px',
                            boxShadow: '0 10px 35px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontWeight: 950
                        }}
                    >
                        <Flame size={18} />
                        <span>
                            {lastBidAlert.isMyTeam
                                ? `YOUR BID: ${lastBidAlert.amount} Pushp`
                                : `${lastBidAlert.team_name}: ${lastBidAlert.amount} Pushp`}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* === 1. TOP HERO FRANCHISE COMMAND BANNER === */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(0,0,0,0.6))',
                borderRadius: '26px',
                border: '1px solid rgba(255,215,0,0.25)',
                padding: '24px 30px',
                marginBottom: '25px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '20px'
            }}>
                {/* Franchise Identity */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #ffd700, #ff9900)',
                        color: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 950,
                        fontSize: '1.8rem',
                        boxShadow: '0 0 30px rgba(255,215,0,0.35)',
                        flexShrink: 0
                    }}>
                        {team.name[0]}
                    </div>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '2px' }}>
                            OFFICIAL FRANCHISE DASHBOARD
                        </div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 950, margin: '2px 0 0', lineHeight: 1.1 }}>
                            {team.name.toUpperCase()}
                        </h1>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '4px' }}>
                            Captain: <strong style={{ color: '#fff' }}>{team.captain_email || user?.email}</strong>
                        </div>
                    </div>
                </div>

                {/* Key Metrics & Direct Auction Link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '25px', flexWrap: 'wrap' }}>
                    {/* Remaining Purse */}
                    <div style={{
                        padding: '12px 20px',
                        borderRadius: '16px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        textAlign: 'right'
                    }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '1px' }}>
                            REMAINING PURSE
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 950, color: 'var(--primary)', lineHeight: 1.1 }}>
                            {team.remaining_budget ?? 0} P
                        </div>
                    </div>

                    {/* Squad Count */}
                    <div style={{
                        padding: '12px 20px',
                        borderRadius: '16px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        textAlign: 'right'
                    }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '1px' }}>
                            SQUAD SIZE
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#fff', lineHeight: 1.1 }}>
                            {players.length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 700 }}>/ {MAX_SQUAD_SIZE}</span>
                        </div>
                    </div>

                    {/* BIG GLOWING CTA TO LIVE AUCTION ARENA */}
                    <Link
                        href="/captain/auction"
                        className="btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '14px 28px',
                            fontSize: '1rem',
                            fontWeight: 950,
                            borderRadius: '16px',
                            boxShadow: isAuctionBidding ? '0 0 35px rgba(255, 165, 0, 0.6)' : '0 4px 20px rgba(0,0,0,0.5)',
                            background: isAuctionBidding
                                ? 'linear-gradient(135deg, #00ff80, #00aa50)'
                                : 'linear-gradient(135deg, #ffd700, #ff9900)',
                            color: isAuctionBidding ? '#000' : '#000',
                            letterSpacing: '0.5px'
                        }}
                    >
                        <Gavel size={22} />
                        <span>{isAuctionBidding ? '⚡ ENTER LIVE AUCTION' : 'VIEW LIVE AUCTION'}</span>
                        <ArrowRight size={18} />
                    </Link>
                </div>
            </div>

            {/* === 2. LIVE AUCTION FLOOR SPOTLIGHT CARD === */}
            <div style={{
                background: isAuctionBidding
                    ? 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(0,0,0,0.7))'
                    : 'rgba(255,255,255,0.02)',
                borderRadius: '24px',
                border: isAuctionBidding
                    ? '2px solid rgba(255,215,0,0.3)'
                    : '1px solid rgba(255,255,255,0.06)',
                padding: '20px 26px',
                marginBottom: '25px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: isAuctionBidding ? '#00ff80' : 'var(--text-muted)',
                        boxShadow: isAuctionBidding ? '0 0 12px #00ff80' : 'none'
                    }} />
                    <div>
                        <div style={{ fontSize: '0.7rem', color: isAuctionBidding ? '#00ff80' : 'var(--text-muted)', fontWeight: 900, letterSpacing: '1.5px' }}>
                            {isAuctionBidding ? 'LIVE AUCTION IN PROGRESS' : 'AUCTION FLOOR STATUS'}
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>
                            {isAuctionBidding && currentPlayer
                                ? `Current Player: ${currentPlayer.first_name} ${currentPlayer.last_name} (${currentPlayer.cricket_skill})`
                                : auctionState?.status === 'SOLD' && currentPlayer
                                    ? `Last Sold: ${currentPlayer.first_name} ${currentPlayer.last_name}`
                                    : 'Auction is currently idle. Waiting for admin to place the next player.'}
                        </div>
                    </div>
                </div>

                {isAuctionBidding && currentPlayer ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 800 }}>CURRENT BID</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#fff', lineHeight: 1.1 }}>
                                {formatPushp(auctionState?.current_highest_bid || 0)}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>HIGHEST BIDDER</div>
                            <div style={{
                                fontSize: '1.1rem',
                                fontWeight: 950,
                                color: isLeadingCurrentPlayer ? '#00ff80' : 'var(--primary)'
                            }}>
                                {isLeadingCurrentPlayer ? '👑 YOUR TEAM' : (teamsMap[auctionState?.highest_bid_team_id] || 'Franchise')}
                            </div>
                        </div>
                        <Link
                            href="/captain/auction"
                            className="btn-primary"
                            style={{
                                padding: '10px 20px',
                                fontSize: '0.85rem',
                                fontWeight: 900,
                                borderRadius: '12px'
                            }}
                        >
                            BID NOW
                        </Link>
                    </div>
                ) : (
                    <Link
                        href="/captain/auction"
                        className="btn-secondary"
                        style={{
                            padding: '8px 18px',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            borderRadius: '12px'
                        }}
                    >
                        Go to Arena
                    </Link>
                )}
            </div>

            {/* === 3. SQUAD STATS & PURSE UTILIZATION ROW === */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '20px',
                marginBottom: '25px'
            }}>
                {/* Squad Composition Box */}
                <div className="glass" style={{ padding: '24px', borderRadius: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                        <PieChart size={20} color="var(--primary)" />
                        <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0 }}>SQUAD COMPOSITION</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                        {Object.entries(squadStats).map(([role, count]) => (
                            <div
                                key={role}
                                style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    padding: '16px 10px',
                                    borderRadius: '16px',
                                    textAlign: 'center',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}
                            >
                                <div style={{
                                    fontSize: '1.8rem',
                                    fontWeight: 950,
                                    color: count > 0 ? 'var(--primary)' : 'rgba(255,255,255,0.15)',
                                    lineHeight: 1.1
                                }}>
                                    {count}
                                </div>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {role.toUpperCase()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Purse Utilization Box */}
                <div className="glass" style={{ padding: '24px', borderRadius: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                        <Wallet size={20} color="var(--primary)" />
                        <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0 }}>PURSE UTILIZATION</h3>
                    </div>
                    <div style={{
                        height: '14px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        marginBottom: '16px'
                    }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pursePercentage}%` }}
                            transition={{ duration: 0.6 }}
                            style={{
                                height: '100%',
                                background: 'linear-gradient(90deg, var(--primary), #ffa500)'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>REMAINING</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 950, color: 'var(--primary)' }}>
                                {team.remaining_budget ?? 0} P
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>TOTAL SPENT</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 950, opacity: 0.7 }}>
                                {spentBudget} P
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* === 4. FRANCHISE SQUAD ROSTER (PLAYER CARDS GRID) === */}
            <div className="glass" style={{ padding: '26px', borderRadius: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={22} color="var(--primary)" />
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 950, margin: 0 }}>
                            FRANCHISE SQUAD ({players.length} / {MAX_SQUAD_SIZE})
                        </h2>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        All secured players in your team
                    </div>
                </div>

                {players.length === 0 ? (
                    <div style={{
                        padding: '60px 20px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.01)',
                        borderRadius: '20px',
                        border: '1px dashed rgba(255,255,255,0.1)'
                    }}>
                        <Trophy size={48} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>No Players Bought Yet</div>
                        <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                            Head over to the Live Auction arena to start bidding for your dream squad!
                        </p>
                        <Link href="/captain/auction" className="btn-primary" style={{ marginTop: '16px', display: 'inline-block', padding: '10px 22px', fontSize: '0.85rem' }}>
                            Go To Live Auction
                        </Link>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: '16px'
                    }}>
                        {players.map((p, idx) => (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: '18px',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    padding: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '14px',
                                    transition: 'all 0.2s ease'
                                }}
                                className="hover:border-yellow-500/30"
                            >
                                <div style={{
                                    width: '54px',
                                    height: '64px',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    background: '#111',
                                    flexShrink: 0,
                                    border: '1px solid rgba(255,215,0,0.3)'
                                }}>
                                    <img
                                        src={fixPhotoUrl(p.photo_url, p.first_name)}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`;
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontWeight: 900,
                                        fontSize: '0.95rem',
                                        color: '#fff',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {p.first_name} {p.last_name}
                                    </div>
                                    <div style={{
                                        display: 'inline-block',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        background: 'rgba(255,215,0,0.1)',
                                        color: 'var(--primary)',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        marginTop: '3px'
                                    }}>
                                        {p.cricket_skill || p.role || 'Player'}
                                    </div>
                                    <div style={{
                                        fontSize: '0.95rem',
                                        fontWeight: 950,
                                        color: 'var(--primary)',
                                        marginTop: '4px'
                                    }}>
                                        {p.sold_price} Pushp
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
