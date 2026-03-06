'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import AuctionRoom from '@/components/AuctionRoom';
import Leaderboard from '@/components/Leaderboard';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Users, History, TrendingUp, PieChart, Shield, Zap, Info, MapPin, User, Trophy, LogOut } from 'lucide-react';

export default function DashboardPage() {
    const [team, setTeam] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [currentPlayer, setCurrentPlayer] = useState<any>(null);
    const [lastBidAlert, setLastBidAlert] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        let teamSub: any = null;
        let stateSub: any = null;

        const setupSubscriptions = async () => {
            try {
                // 1. Initial data fetch
                const { data: { user } } = await supabase.auth.getUser();
                if (!user || !isMounted) {
                    setLoading(false);
                    return;
                }

                const teamName = user.user_metadata?.team_name;
                const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
                let effectiveTeamName = teamName;

                if (roleData?.role?.toLowerCase() === 'admin' && !effectiveTeamName) {
                    const { data: firstTeam } = await supabase.from('teams').select('name').limit(1).single();
                    effectiveTeamName = firstTeam?.name;
                }

                if (!effectiveTeamName) {
                    setLoading(false);
                    return;
                }

                const { data: teamData } = await supabase.from('teams').select('*').eq('name', effectiveTeamName).single();
                if (teamData && isMounted) {
                    setTeam(teamData);
                    const { data: playerData } = await supabase.from('players').select('*').eq('team_id', teamData.id);
                    setPlayers(playerData || []);

                    // 2. Setup team sync subscription ONLY after we have team data
                    teamSub = supabase
                        .channel(`team_control_${teamData.id}`)
                        .on('postgres_changes' as any, { event: '*', table: 'teams', filter: `id=eq.${teamData.id}` }, (payload: any) => {
                            if (isMounted) setTeam(payload.new);
                        })
                        .subscribe();
                }

                // 3. Always setup auction state sync
                stateSub = supabase.channel('auction_hub_sync')
                    .on('postgres_changes' as any, { event: '*', table: 'auction_state' }, (payload: any) => {
                        if (isMounted) {
                            setAuctionState(payload.new);
                            if (payload.new.current_player_id) {
                                fetchCurrentPlayer(payload.new.current_player_id);
                            } else {
                                setCurrentPlayer(null);
                            }
                        }
                    })
                    .on('postgres_changes' as any, { event: 'INSERT', table: 'bids', schema: 'public' }, async (payload: any) => {
                        if (!isMounted) return;
                        const { data: bTeam } = await supabase.from('teams').select('name').eq('id', payload.new.team_id).single();
                        if (isMounted) {
                            setLastBidAlert({ ...payload.new, team_name: bTeam?.name || 'A Franchise' });
                            setTimeout(() => { if (isMounted) setLastBidAlert(null); }, 4000);
                        }
                    })
                    .on('postgres_changes' as any, { event: 'UPDATE', table: 'players' }, (payload: any) => {
                        // Refresh squad if any player changes team_id to our team (sold) OR away from our team (deleted/reset)
                        if (isMounted && teamData && (payload.new.team_id === teamData.id || payload.old?.team_id === teamData.id)) {
                            fetchSquad(teamData.id);
                        }
                    })
                    .subscribe();

                // Initial auction state fetch
                const { data: auctionData } = await supabase.from('auction_state').select('*').single();
                if (auctionData && isMounted) {
                    setAuctionState(auctionData);
                    if (auctionData.current_player_id) fetchCurrentPlayer(auctionData.current_player_id);
                }

            } catch (err) {
                console.error('Initial Setup Error:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        setupSubscriptions();

        return () => {
            isMounted = false;
            if (teamSub) supabase.removeChannel(teamSub);
            if (stateSub) supabase.removeChannel(stateSub);
        };
    }, []);

    const fetchTeamData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const teamName = user.user_metadata?.team_name;
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .single();

            const role = roleData?.role;
            let effectiveTeamName = teamName;

            // If Admin, they can view any team. If no teamName in metadata, pick the first one from DB
            if (role === 'admin' && !effectiveTeamName) {
                const { data: firstTeam } = await supabase.from('teams').select('name').limit(1).single();
                effectiveTeamName = firstTeam?.name;
            }

            if (!effectiveTeamName) {
                setLoading(false);
                return;
            }

            const { data: teamData, error: teamErr } = await supabase
                .from('teams')
                .select('*')
                .eq('name', effectiveTeamName)
                .single();

            if (teamErr) {
                console.error('Team Fetch Error:', teamErr);
                setLoading(false);
                return;
            }

            if (teamData) {
                console.log('Team data found in DB:', teamData);
                setTeam(teamData);
                fetchSquad(teamData.id);
            }
        } catch (err) {
            console.error('fetchTeamData failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSquad = async (teamId?: string) => {
        const id = teamId || team?.id;
        if (!id) return;
        const { data: playerData } = await supabase.from('players').select('*').eq('team_id', id);
        setPlayers(playerData || []);
    };

    const fetchCurrentPlayer = async (id: string) => {
        const { data } = await supabase.from('players').select('*').eq('id', id).single();
        setCurrentPlayer(data);
    };


    const squadStats = useMemo(() => {
        const roles = {
            Batsman: players.filter(p => p.role === 'Batsman').length,
            Bowler: players.filter(p => p.role === 'Bowler').length,
            'All-rounder': players.filter(p => p.role === 'All-rounder').length,
            Wicketkeeper: players.filter(p => p.role === 'Wicketkeeper').length,
        };
        return roles;
    }, [players]);

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)', color: 'white' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ repeat: Infinity, duration: 1, repeatType: 'reverse' }}>
                <Zap size={48} color="var(--primary)" />
                <p style={{ marginTop: '20px', fontWeight: 600 }}>INITIALIZING CONTROL CENTER...</p>
            </motion.div>
        </div>
    );

    if (!team) return (
        <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)', color: 'white' }}>
            <div className="glass" style={{ padding: '40px', textAlign: 'center' }}>
                <Shield size={64} color="var(--accent)" style={{ marginBottom: '20px' }} />
                <h2>Access Restricted</h2>
                <p style={{ color: 'var(--text-muted)', margin: '15px 0 25px' }}>Please login to access your franchise control center.</p>
                <a href="/login" className="btn-primary">LOGIN NOW</a>
            </div>
        </div>
    );

    const latestPlayer = players.length > 0 ? players[players.length - 1] : null;

    return (
        <>
            <main style={{ minHeight: '100vh', background: '#000000', color: '#fff' }}>
                <Navbar />

                {/* REAL-TIME BID NOTIFICATION */}
                <AnimatePresence>
                    {lastBidAlert && (
                        <motion.div
                            initial={{ y: -100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -100, opacity: 0 }}
                            style={{
                                position: 'fixed',
                                top: '20px',
                                right: '20px',
                                zIndex: 1000,
                                background: 'rgba(255, 215, 0, 0.15)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid var(--primary)',
                                padding: '15px 25px',
                                borderRadius: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                            }}
                        >
                            <Trophy size={20} color="var(--primary)" />
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '1px' }}>NEW BID PLACED!</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 900 }}>
                                    {lastBidAlert.team_name} bid <span style={{ color: 'var(--primary)' }}>₹ {(lastBidAlert.amount / 10000000).toFixed(2)} Cr</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* TOP INFOBAR */}
                <div style={{
                    minHeight: '70px',
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 20px',
                    position: 'sticky',
                    top: '0',
                    zIndex: 100,
                    backdropFilter: 'blur(10px)',
                    flexWrap: 'wrap',
                    gap: '15px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#000', fontSize: '0.9rem' }}>
                            {team.name[0]}
                        </div>
                        <div>
                            <span style={{
                                background: 'rgba(0, 255, 128, 0.1)',
                                color: '#00ff80',
                                border: '1px solid rgba(0, 255, 128, 0.3)',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                marginBottom: '5px',
                                display: 'inline-block'
                            }}>FRANCHISE OWNER</span>
                            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{team.name}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Portal Active</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>REMAINING BUDGET</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary)' }}>₹ {(team.remaining_budget / 10000000).toFixed(2)} Cr</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>SQUAD SIZE</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{players.length} / {team.max_players}</div>
                        </div>
                    </div>
                </div>

                <div className="container-responsive" style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '25px' }}>
                    {/* LEFT: BIDDING COMMAND CENTER */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                        {/* MAIN BIDDING HUB */}
                        <div className="glass shadow-premium" style={{
                            padding: '0',
                            borderRadius: '35px',
                            border: '1px solid rgba(255,215,0,0.15)',
                            overflow: 'hidden',
                            background: 'linear-gradient(180deg, rgba(255,215,0,0.05) 0%, rgba(0,0,0,0) 100%)'
                        }}>
                            <div style={{ padding: '25px 35px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px var(--primary-glow)' }}>
                                        <Zap color="#000" size={24} fill="currentColor" />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.2rem', fontWeight: 950, letterSpacing: '0.5px' }}>BIDDING HUB</h2>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '1px' }}>REAL-TIME SYNC ACTIVE</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ padding: '6px 15px', background: 'rgba(0, 255, 128, 0.1)', color: '#00ff80', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(0, 255, 128, 0.2)' }}>
                                        <div style={{ width: '8px', height: '8px', background: '#00ff80', borderRadius: '50%' }} className="pulse"></div>
                                        WEBSOCKET LIVE
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: '35px' }}>
                                <AuctionRoom teamId={team.id} />
                            </div>
                        </div>

                        {/* ANALYTICS & STRATEGY */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '25px' }}>
                            <div className="glass" style={{ padding: '30px', borderRadius: '30px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                                    <PieChart size={20} color="var(--primary)" />
                                    <h3 style={{ fontSize: '1rem', fontWeight: 900 }}>SQUAD COMPOSITION</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                                    {Object.entries(squadStats).map(([role, count]) => (
                                        <div key={role} style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '20px', border: '1px solid var(--border)', textAlign: 'center', transition: 'all 0.3s ease' }}>
                                            <div style={{ fontSize: '1.8rem', fontWeight: 950, color: count > 0 ? 'var(--primary)' : 'rgba(255,255,255,0.2)', marginBottom: '5px' }}>{count}</div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>{role}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '30px', borderRadius: '30px', border: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(255,215,0,0.03) 0%, transparent 100%)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                                    <Wallet size={20} color="var(--primary)" />
                                    <h3 style={{ fontSize: '1rem', fontWeight: 900 }}>FINANCIAL HEALTH</h3>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', height: '12px', borderRadius: '6px', position: 'relative', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(team.remaining_budget / team.total_budget) * 100}%` }}
                                            style={{ height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, #ffa500 100%)', boxShadow: '0 0 15px var(--primary-glow)' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>SPENDABLE PURSE</div>
                                            <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#fff' }}>₹ {(team.remaining_budget / 10000000).toFixed(2)} <span style={{ fontSize: '1rem', color: 'var(--primary)' }}>Cr</span></div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>EXPENDED</div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'rgba(255,255,255,0.5)' }}>₹ {((team.total_budget - team.remaining_budget) / 10000000).toFixed(2)} Cr</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: REAL-TIME FEED & SQUAD */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* LATEST BUY WIDGET */}
                        <AnimatePresence>
                            {latestPlayer && (
                                <motion.div
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    className="glass"
                                    style={{ padding: '15px', borderRadius: '20px', borderLeft: '4px solid #00ff80', background: 'rgba(0, 255, 128, 0.05)' }}
                                >
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#00ff80', marginBottom: '8px' }}>LATEST BUY</div>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#222', overflow: 'hidden' }}>
                                            <img src={latestPlayer.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${latestPlayer.name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={latestPlayer.name} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900 }}>{latestPlayer.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹ {(latestPlayer.sold_price / 10000000).toFixed(2)} Cr</div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* PLAYER INFORMATION */}
                        <div className="glass" style={{ borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border)', fontWeight: 800, display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span>TEAM SQUAD</span>
                                <span style={{ color: 'var(--primary)' }}>{players.length}</span>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', padding: '12px' }}>
                                {players.length === 0 ? (
                                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <Users size={24} style={{ opacity: 0.2, marginBottom: '10px' }} />
                                        <div style={{ fontSize: '0.8rem' }}>No players acquired yet.</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {players.map(p => (
                                            <div key={p.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{p.name}</div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>{p.role.toUpperCase()}</div>
                                                </div>
                                                <div style={{ fontWeight: 900, fontSize: '0.85rem' }}>₹ {(p.sold_price / 10000000).toFixed(2)} Cr</div>
                                            </div>
                                        )).reverse()}
                                    </div>
                                )}
                            </div>
                        </div>

                        <Leaderboard selectedTeamId={team.id} />
                    </div>
                </div>


            </main>
            <style jsx>{`
                @media (max-width: 1100px) {
                    .container-responsive {
                        grid-template-columns: 1fr !important;
                    }
                }
                .pulse { animation: pulse 2s infinite; }
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
            `}</style>
        </>
    );
}
