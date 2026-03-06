'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { ScrollText, Clock, TrendingUp } from 'lucide-react';

export default function GlobalHistoryPage() {
    const [bids, setBids] = useState<any[]>([]);
    const [soldPlayers, setSoldPlayers] = useState<any[]>([]);

    useEffect(() => {
        fetchHistory();

        // Real-time updates for history using correct Supabase Channel parameters
        const historySub = supabase.channel('history-feed')
            .on('postgres_changes', {
                event: 'INSERT',
                table: 'bids',
                schema: 'public'
            }, () => fetchHistory())
            .on('postgres_changes', {
                event: 'UPDATE',
                table: 'players',
                schema: 'public'
            }, () => fetchHistory())
            .subscribe();

        return () => { supabase.removeChannel(historySub); };
    }, []);

    const fetchHistory = async () => {
        const { data: b } = await supabase
            .from('bids')
            .select('*, teams(name), players(first_name, last_name)')
            .order('created_at', { ascending: false })
            .limit(50);

        const { data: p } = await supabase
            .from('players')
            .select('*, teams(name)')
            .eq('auction_status', 'sold')
            .order('sold_price', { ascending: false });

        if (b) setBids(b);
        if (p) setSoldPlayers(p);
    };

    return (
        <>
            <main style={{ minHeight: '100vh', background: '#000' }}>
                <Navbar />
                <div className="container-responsive" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
                    <h1 className="title-gradient" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', marginBottom: '40px', textAlign: 'center' }}>Auction Activity Feed</h1>

                    <div className="history-grid">
                        {/* Recent Bids Feed */}
                        <div>
                            <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Clock color="var(--primary)" size={20} /> LIVE BID LOG
                            </h2>
                            <div className="glass" style={{ padding: '0' }}>
                                {bids.length === 0 ? (
                                    <p style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No bids placed yet.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {bids.map((bid, index) => (
                                            <div key={bid.id} style={{
                                                padding: '20px',
                                                borderBottom: index !== bids.length - 1 ? '1px solid var(--border)' : 'none',
                                                background: index === 0 ? 'rgba(255, 215, 0, 0.05)' : 'transparent'
                                            }}>
                                                <div className="bid-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>{bid.teams?.name}</span>
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                                                            Placed ₹ <span style={{ color: '#fff', fontWeight: 700 }}>{(bid.amount / 10000000).toFixed(2)} Cr</span> bid
                                                        </div>
                                                    </div>
                                                    <div className="bid-info" style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{bid.players?.first_name} {bid.players?.last_name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(bid.created_at).toLocaleTimeString()}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sold Players Summary */}
                        <div>
                            <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <TrendingUp color="var(--primary)" size={20} /> ACQUISITIONS
                            </h2>
                            <div className="glass padding-responsive" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '700px', overflowY: 'auto' }}>
                                {soldPlayers.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No players sold yet.</p>
                                ) : (
                                    soldPlayers.map((p) => (
                                        <div key={p.id} style={{
                                            background: 'rgba(255,255,255,0.02)',
                                            padding: '15px',
                                            borderRadius: '20px',
                                            border: '1px solid var(--border)',
                                            display: 'flex',
                                            gap: '15px',
                                            alignItems: 'center'
                                        }}>
                                            <div style={{ width: '60px', height: '60px', borderRadius: '12px', overflow: 'hidden', background: '#111', flexShrink: 0 }}>
                                                <img
                                                    src={p.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    alt=""
                                                />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>{p.first_name} {p.last_name}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 800 }}>{p.teams?.name}</div>
                                                    <div style={{ fontWeight: 900, fontSize: '0.9rem' }}>₹ {(p.sold_price / 10000000).toFixed(2)} Cr</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <style jsx>{`
                .history-grid {
                    display: grid;
                    grid-template-columns: 1fr 400px;
                    gap: 40px;
                }
                @media (max-width: 1000px) {
                    .history-grid {
                        grid-template-columns: 1fr;
                    }
                }
                @media (max-width: 768px) {
                    .bid-item {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 15px !important;
                    }
                    .bid-info {
                        text-align: left !important;
                    }
                }
            `}</style>
        </>
    );
}
