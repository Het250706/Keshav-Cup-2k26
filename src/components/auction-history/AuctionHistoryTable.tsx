'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ScrollText, Calendar, Search, Clock, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { fixPhotoUrl } from '@/lib/utils';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AuctionHistoryTable() {
    const [history, setHistory] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchHistory();

        const channel = supabase.channel('history-sync')
            .on('postgres_changes', { event: '*', table: 'players' }, () => fetchHistory())
            .on('postgres_changes', { event: '*', table: 'teams' }, () => fetchHistory())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchHistory = async () => {
        try {
            const [playersRes, teamsRes] = await Promise.all([
                supabase
                    .from('players')
                    .select('*')
                    .eq('auction_status', 'sold')
                    .order('sold_price', { ascending: false }),
                supabase.from('teams').select('*')
            ]);

            if (teamsRes.data) setTeams(teamsRes.data);
            if (playersRes.data) setHistory(playersRes.data);
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setLoading(false);
        }
    };

    // Helper to resolve team name from any available field
    const getTeamName = (p: any): string => {
        // 1. Direct name match in sold_team
        if (p.sold_team && typeof p.sold_team === 'string' && p.sold_team !== 'null' && p.sold_team !== 'undefined') {
            const matchById = teams.find(t => t.id === p.sold_team);
            if (matchById) return matchById.name;
            return p.sold_team;
        }
        // 2. Lookup via team_id UUID
        if (p.team_id) {
            const match = teams.find(t => t.id === p.team_id);
            if (match) return match.name;
        }
        // 3. Lookup via sold_team_id UUID
        if (p.sold_team_id) {
            const match = teams.find(t => t.id === p.sold_team_id);
            if (match) return match.name;
        }
        return 'UNASSIGNED';
    };

    const filteredHistory = history.filter((p: any) => {
        const teamName = getTeamName(p);
        const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
        const skill = (p.cricket_skill || p.role || '').toLowerCase();
        const term = searchTerm.toLowerCase();

        return fullName.includes(term) || teamName.toLowerCase().includes(term) || skill.includes(term);
    });

    if (loading) return <LoadingSpinner />;

    return (
        <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
                <div className="glass" style={{ padding: '5px 20px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '10px', width: '320px', border: '1px solid rgba(255,215,0,0.2)' }}>
                    <Search size={18} color="var(--primary)" />
                    <input
                        type="text"
                        placeholder="SEARCH PLAYER OR TEAM..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', padding: '12px 0', fontSize: '0.9rem', fontWeight: 700, width: '100%' }}
                    />
                </div>
            </div>

            <div className="history-table glass" style={{ borderRadius: '30px', overflow: 'hidden', border: '1px solid rgba(255,215,0,0.15)' }}>
                <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '80px 1.5fr 1.2fr 1fr 1fr', padding: '20px 30px', background: 'rgba(255, 215, 0, 0.05)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '1px' }}>
                    <div>IMG</div>
                    <div>PLAYER NAME & TEAM</div>
                    <div>ASSIGNED TEAM</div>
                    <div>PRICE (P)</div>
                    <div>TIMESTAMP</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filteredHistory.length === 0 ? (
                        <div style={{ padding: '100px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <ScrollText size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                            <p>No sold player records found matching your search.</p>
                        </div>
                    ) : (
                        filteredHistory.map((p, i) => {
                            const teamName = getTeamName(p);
                            const skill = p.cricket_skill || p.role || 'Player';
                            const price = p.sold_price != null ? p.sold_price : (p.base_price || 0);

                            return (
                                <motion.div
                                    key={p.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                                    className="table-row"
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '80px 1.5fr 1.2fr 1fr 1fr',
                                        padding: '18px 30px',
                                        borderBottom: i === filteredHistory.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                                        alignItems: 'center',
                                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                                    }}
                                >
                                    <div style={{ width: '52px', height: '52px', borderRadius: '14px', overflow: 'hidden', background: '#111', border: '1px solid rgba(255,215,0,0.2)' }}>
                                        <img
                                            src={fixPhotoUrl(p.photo_url, p.first_name)}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            alt=""
                                            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }}
                                        />
                                    </div>

                                    {/* PLAYER NAME WITH TEAM NAME BESIDE / UNDER IT */}
                                    <div style={{ minWidth: 0, paddingRight: '15px' }}>
                                        <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {p.first_name} {p.last_name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ color: teamName !== 'UNASSIGNED' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 900 }}>
                                                {teamName}
                                            </span>
                                            <span>·</span>
                                            <span>{skill.toUpperCase()}</span>
                                        </div>
                                    </div>

                                    {/* TEAM COLUMN */}
                                    <div>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 16px',
                                            borderRadius: '12px',
                                            background: teamName !== 'UNASSIGNED' ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                                            fontSize: '0.85rem',
                                            fontWeight: 900,
                                            color: teamName !== 'UNASSIGNED' ? 'var(--primary)' : 'var(--text-muted)',
                                            border: teamName !== 'UNASSIGNED' ? '1px solid rgba(255, 215, 0, 0.25)' : '1px solid rgba(255,255,255,0.08)',
                                            whiteSpace: 'nowrap',
                                            boxShadow: teamName !== 'UNASSIGNED' ? '0 0 15px rgba(255, 215, 0, 0.08)' : 'none'
                                        }}>
                                            <Shield size={14} color={teamName !== 'UNASSIGNED' ? 'var(--primary)' : 'currentColor'} />
                                            {teamName}
                                        </span>
                                    </div>

                                    {/* PRICE COLUMN */}
                                    <div style={{ fontWeight: 950, color: '#00ff80', fontSize: '1.2rem' }}>
                                        {price} P
                                    </div>

                                    {/* TIMESTAMP COLUMN */}
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Calendar size={13} /> {new Date(p.created_at || Date.now()).toLocaleDateString()}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                            <Clock size={13} /> {new Date(p.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </div>

            <style jsx>{`
                .table-row:hover {
                    background: rgba(255, 215, 0, 0.03) !important;
                }
                @media (max-width: 900px) {
                    .table-header, .table-row {
                        grid-template-columns: 60px 1.2fr 1fr 1fr !important;
                    }
                    div:nth-child(5) { display: none !important; }
                }
                @media (max-width: 600px) {
                    .table-header, .table-row {
                        grid-template-columns: 60px 1.5fr 1fr !important;
                    }
                    div:nth-child(4) { display: none !important; }
                }
            `}</style>
        </div>
    );
}
