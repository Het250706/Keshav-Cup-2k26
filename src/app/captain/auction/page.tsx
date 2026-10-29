'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import RoleGuard from '@/components/RoleGuard';
import { useAuth } from '@/components/AuthProvider';
import { fixPhotoUrl } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Gavel,
    Loader2,
    History,
    Zap,
    Trophy,
    Flame,
    CheckCircle2,
    AlertCircle,
    LayoutDashboard,
    Shield
} from 'lucide-react';
import { getPurplePushp, getNextBid, MAX_SQUAD_SIZE } from '@/lib/auction-logic';
import { playBidSound, playHammerSound } from '@/lib/audio';
import Link from 'next/link';

export default function CaptainAuctionPage() {
    return (
        <RoleGuard allowedRole="captain">
            <CaptainAuctionContent />
        </RoleGuard>
    );
}

function CaptainAuctionContent() {
    const { user } = useAuth();
    const [myTeam, setMyTeam] = useState<any>(null);
    const [mySquadCount, setMySquadCount] = useState(0);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [currentPlayer, setCurrentPlayer] = useState<any>(null);
    const [teamsMap, setTeamsMap] = useState<Record<string, string>>({});
    const [bidHistory, setBidHistory] = useState<any[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isBidding, setIsBidding] = useState(false);
    const [bidToast, setBidToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [lastBidAlert, setLastBidAlert] = useState<{ team_name: string; amount: number; isMyTeam: boolean } | null>(null);

    const currentPlayerIdRef = useRef<string | null>(null);
    const myTeamRef = useRef<any>(null);
    const teamsMapRef = useRef<Record<string, string>>({});

    // Update ref whenever teamsMap changes
    useEffect(() => {
        teamsMapRef.current = teamsMap;
    }, [teamsMap]);

    // Fast parallel initial data fetch
    const fetchInitialData = useCallback(async () => {
        if (!user) return;

        try {
            // Run all primary lookups in parallel with Promise.all
            const [teamsRes, stateRes] = await Promise.all([
                supabase.from('teams').select('id, name, remaining_budget, captain_email'),
                supabase.from('auction_state').select('*').single()
            ]);

            // Build teams lookup map in memory (0ms access)
            const map: Record<string, string> = {};
            let currentTeam: any = null;

            if (teamsRes.data) {
                teamsRes.data.forEach((t: any) => {
                    map[t.id] = t.name;
                    if (user.user_metadata?.team_name && t.name.toLowerCase() === user.user_metadata.team_name.toLowerCase()) {
                        currentTeam = t;
                    } else if (!currentTeam && user.email && t.captain_email && t.captain_email.toLowerCase() === user.email.toLowerCase()) {
                        currentTeam = t;
                    }
                });
                setTeamsMap(map);
                teamsMapRef.current = map;
            }

            if (currentTeam) {
                setMyTeam(currentTeam);
                myTeamRef.current = currentTeam;

                // Squad count in background
                supabase
                    .from('players')
                    .select('*', { count: 'exact', head: true })
                    .eq('team_id', currentTeam.id)
                    .eq('auction_status', 'sold')
                    .then(({ count }) => setMySquadCount(count || 0));
            }

            const stateData = stateRes.data;
            if (stateData) {
                setAuctionState(stateData);
                currentPlayerIdRef.current = stateData.current_player_id;

                if (stateData.current_player_id) {
                    // Fetch player and bid history concurrently
                    const [playerRes, bidsRes] = await Promise.all([
                        supabase.from('players').select('*').eq('id', stateData.current_player_id).single(),
                        supabase.from('bids').select('*, teams(name)').eq('player_id', stateData.current_player_id).order('created_at', { ascending: false }).limit(10)
                    ]);

                    if (playerRes.data) setCurrentPlayer(playerRes.data);
                    if (bidsRes.data) setBidHistory(bidsRes.data);
                }
            }
        } catch (err) {
            console.error('Initial fetch error:', err);
        } finally {
            setInitialLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchInitialData();

        // High performance realtime channel — ZERO redundant refetches!
        const stateSub = supabase.channel('captain_auction_stream_v5')
            .on('postgres_changes', { event: '*', table: 'auction_state', schema: 'public' }, async (p: any) => {
                const newState = p.new;
                setAuctionState(newState);

                if (newState?.status === 'SOLD') {
                    playHammerSound();
                }

                // Only fetch player if ID actually CHANGED to a new player
                if (newState?.current_player_id && newState.current_player_id !== currentPlayerIdRef.current) {
                    currentPlayerIdRef.current = newState.current_player_id;
                    const { data: newP } = await supabase.from('players').select('*').eq('id', newState.current_player_id).single();
                    if (newP) setCurrentPlayer(newP);

                    const { data: newBids } = await supabase.from('bids').select('*, teams(name)').eq('player_id', newState.current_player_id).order('created_at', { ascending: false }).limit(10);
                    if (newBids) setBidHistory(newBids);
                } else if (!newState?.current_player_id) {
                    currentPlayerIdRef.current = null;
                    setCurrentPlayer(null);
                    setBidHistory([]);
                }
            })
            .on('postgres_changes', { event: '*', table: 'teams', schema: 'public' }, (p: any) => {
                if (p.new) {
                    // Update teamsMap in-place
                    setTeamsMap(prev => ({ ...prev, [p.new.id]: p.new.name }));
                    if (myTeamRef.current && p.new.id === myTeamRef.current.id) {
                        setMyTeam(p.new);
                        myTeamRef.current = p.new;
                    }
                }
            })
            .on('postgres_changes', { event: 'INSERT', table: 'bids', schema: 'public' }, (payload: any) => {
                const newBid = payload.new;
                playBidSound();

                const teamName = teamsMapRef.current[newBid.team_id] || 'A Franchise';
                const isMyTeam = myTeamRef.current?.id === newBid.team_id;

                // 1. Instantly update live bid feed without network roundtrip!
                setBidHistory(prev => [
                    { ...newBid, teams: { name: teamName } },
                    ...prev.filter(b => b.id !== newBid.id).slice(0, 9)
                ]);

                // 2. Instantly update current bid in state
                setAuctionState((prev: any) => prev ? {
                    ...prev,
                    current_highest_bid: newBid.amount,
                    highest_bid_team_id: newBid.team_id,
                    highest_bid_team_name: teamName
                } : null);

                // 3. Trigger live banner
                setLastBidAlert({
                    team_name: teamName,
                    amount: newBid.amount,
                    isMyTeam
                });

                setTimeout(() => setLastBidAlert(null), 3500);
            })
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
    }, [fetchInitialData]);

    // === 0MS OPTIMISTIC BIDDING HANDLER ===
    const handlePlaceBid = async () => {
        if (!myTeam || isBidding || auctionState?.status !== 'BIDDING' || !currentPlayer) return;

        const nextBid = getNextBid(auctionState.current_highest_bid || 0);

        if (myTeam.remaining_budget < nextBid) {
            setBidToast({
                message: `Insufficient Purse! You have ${myTeam.remaining_budget} P, need ${nextBid} P.`,
                type: 'error'
            });
            setTimeout(() => setBidToast(null), 3000);
            return;
        }

        if (mySquadCount >= MAX_SQUAD_SIZE) {
            setBidToast({
                message: `Squad limit reached (${MAX_SQUAD_SIZE}/${MAX_SQUAD_SIZE} players).`,
                type: 'error'
            });
            setTimeout(() => setBidToast(null), 3000);
            return;
        }

        if (auctionState.highest_bid_team_id === myTeam.id) {
            setBidToast({ message: 'Your team is already the highest bidder!', type: 'info' });
            setTimeout(() => setBidToast(null), 2000);
            return;
        }

        // --- OPTIMISTIC UI UPDATE (0ms instant response) ---
        setIsBidding(true);
        playBidSound();

        const previousState = { ...auctionState };
        setAuctionState((prev: any) => ({
            ...prev,
            current_highest_bid: nextBid,
            highest_bid_team_id: myTeam.id,
            highest_bid_team_name: myTeam.name
        }));

        setBidHistory(prev => [
            {
                id: 'optimistic-' + Date.now(),
                amount: nextBid,
                team_id: myTeam.id,
                teams: { name: myTeam.name },
                created_at: new Date().toISOString()
            },
            ...prev.slice(0, 9)
        ]);

        setBidToast({
            message: `Bid placed for ${nextBid} Pushp! ✓`,
            type: 'success'
        });
        setTimeout(() => setBidToast(null), 2500);

        // Send API call in background
        try {
            const res = await fetch('/api/auction/v3/bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_id: myTeam.id })
            });

            const result = await res.json();
            if (!res.ok) {
                // Revert optimistic update on failure
                setAuctionState(previousState);
                throw new Error(result.error || 'Failed to place bid');
            }
        } catch (err: any) {
            setBidToast({ message: err.message, type: 'error' });
            setTimeout(() => setBidToast(null), 3500);
        } finally {
            setTimeout(() => setIsBidding(false), 700);
        }
    };

    const nextBid = useMemo(() => getNextBid(auctionState?.current_highest_bid || 0), [auctionState?.current_highest_bid]);
    const isLeading = Boolean(auctionState?.highest_bid_team_id && myTeam && auctionState.highest_bid_team_id === myTeam.id);
    const isInsufficient = Boolean(myTeam && myTeam.remaining_budget < nextBid);
    const isSquadFull = mySquadCount >= MAX_SQUAD_SIZE;
    const canBid = auctionState?.status === 'BIDDING' && currentPlayer && !isLeading && !isInsufficient && !isSquadFull && !isBidding;

    const highestBidderName = useMemo(() => {
        if (!auctionState?.highest_bid_team_id) return null;
        if (myTeam && auctionState.highest_bid_team_id === myTeam.id) return myTeam.name;
        return teamsMap[auctionState.highest_bid_team_id] || auctionState.highest_bid_team_name || 'A Franchise';
    }, [auctionState?.highest_bid_team_id, auctionState?.highest_bid_team_name, myTeam, teamsMap]);

    const formatPushp = (amount: number) => {
        const purple = getPurplePushp(amount);
        return `${amount.toLocaleString()} Pushp${purple ? ` (${purple} Purple)` : ''}`;
    };

    if (initialLoading) {
        return (
            <div style={{ height: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px', color: '#fff' }}>
                <Loader2 className="animate-spin" size={40} color="var(--primary)" />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '1px' }}>
                    CONNECTING TO LIVE AUCTION...
                </span>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '15px 20px', minHeight: 'calc(100vh - 100px)' }}>

            {/* REAL-TIME BID ALERT BANNER (TOP FLOATING) */}
            <AnimatePresence>
                {lastBidAlert && (
                    <motion.div
                        initial={{ y: -50, opacity: 0, scale: 0.95 }}
                        animate={{ y: 15, opacity: 1, scale: 1 }}
                        exit={{ y: -50, opacity: 0, scale: 0.95 }}
                        style={{
                            position: 'fixed',
                            top: '85px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 9999,
                            background: lastBidAlert.isMyTeam
                                ? 'linear-gradient(135deg, rgba(0, 255, 128, 0.95), rgba(0, 180, 80, 0.95))'
                                : 'linear-gradient(135deg, rgba(255, 215, 0, 0.95), rgba(255, 140, 0, 0.95))',
                            color: '#000',
                            padding: '12px 28px',
                            borderRadius: '50px',
                            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontWeight: 950,
                            letterSpacing: '0.5px'
                        }}
                    >
                        <Flame size={20} className="animate-bounce" />
                        <span style={{ fontSize: '0.95rem' }}>
                            {lastBidAlert.isMyTeam
                                ? `🎉 YOUR BID OF ${lastBidAlert.amount} PUSHP IS ACCEPTED!`
                                : `🔥 ${lastBidAlert.team_name.toUpperCase()} BID ${lastBidAlert.amount} PUSHP!`}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FLOATING ACTION TOAST */}
            <AnimatePresence>
                {bidToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        style={{
                            position: 'fixed',
                            bottom: '25px',
                            right: '25px',
                            zIndex: 9999,
                            background: bidToast.type === 'error'
                                ? 'rgba(255, 50, 50, 0.95)'
                                : bidToast.type === 'info'
                                    ? 'rgba(0, 210, 255, 0.95)'
                                    : 'rgba(0, 200, 83, 0.95)',
                            color: '#fff',
                            padding: '12px 20px',
                            borderRadius: '14px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontWeight: 800,
                            fontSize: '0.9rem'
                        }}
                    >
                        {bidToast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                        <span>{bidToast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TOP BAR: TEAM HEADER & LIVE STATUS */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px',
                background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,255,255,0.02))',
                borderRadius: '20px',
                border: '1px solid rgba(255,215,0,0.2)',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '15px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '14px',
                        background: 'var(--primary)',
                        color: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 950,
                        fontSize: '1.2rem',
                        boxShadow: '0 0 20px rgba(255,215,0,0.3)'
                    }}>
                        {myTeam?.name ? myTeam.name[0] : 'C'}
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '1.5px' }}>
                            FRANCHISE PORTAL
                        </div>
                        <h1 style={{ fontSize: '1.35rem', fontWeight: 950, margin: 0, lineHeight: 1.1 }}>
                            {myTeam?.name || 'CAPTAIN'}
                        </h1>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '2px' }}>
                            Squad: <span style={{ color: '#fff', fontWeight: 900 }}>{mySquadCount}/{MAX_SQUAD_SIZE}</span>
                        </div>
                    </div>
                </div>

                {/* Center live badge */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 18px',
                    background: auctionState?.status === 'BIDDING'
                        ? 'rgba(0, 255, 128, 0.1)'
                        : 'rgba(255, 215, 0, 0.08)',
                    borderRadius: '50px',
                    border: auctionState?.status === 'BIDDING'
                        ? '1px solid rgba(0, 255, 128, 0.3)'
                        : '1px solid rgba(255, 215, 0, 0.2)'
                }}>
                    <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: auctionState?.status === 'BIDDING' ? '#00ff80' : 'var(--primary)',
                        display: 'inline-block',
                        boxShadow: auctionState?.status === 'BIDDING' ? '0 0 8px #00ff80' : 'none'
                    }} />
                    <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        color: auctionState?.status === 'BIDDING' ? '#00ff80' : 'var(--primary)',
                        letterSpacing: '1.5px'
                    }}>
                        {auctionState?.status === 'BIDDING' ? 'BIDDING OPEN' : 'AUCTION IDLE'}
                    </span>
                </div>

                {/* Right purse & link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '1px' }}>
                            REMAINING PURSE
                        </div>
                        <div style={{ fontSize: '1.7rem', fontWeight: 950, color: 'var(--primary)', lineHeight: 1.1 }}>
                            {myTeam?.remaining_budget ?? 0} P
                        </div>
                    </div>
                    <Link
                        href="/captain/dashboard"
                        className="btn-secondary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            fontSize: '0.8rem',
                            fontWeight: 800
                        }}
                    >
                        <LayoutDashboard size={15} /> Dashboard
                    </Link>
                </div>
            </div>

            {/* MAIN TWO-COLUMN VIEWPORT (FITS ON ONE SCREEN) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '20px', alignItems: 'start' }}>

                {/* LEFT: ACTIVE PLAYER CARD & GLOWING BID CONSOLE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <AnimatePresence mode="wait">
                        {auctionState?.status === 'BIDDING' && currentPlayer ? (
                            <motion.div
                                key={currentPlayer.id}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                            >
                                {/* Compact Player Details Card */}
                                <div className="glass" style={{ padding: '22px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{ display: 'flex', gap: '22px', alignItems: 'center' }}>
                                        <div style={{
                                            width: '160px',
                                            height: '190px',
                                            borderRadius: '18px',
                                            overflow: 'hidden',
                                            border: '2px solid var(--primary)',
                                            background: '#111',
                                            boxShadow: '0 0 25px rgba(255,215,0,0.15)',
                                            flexShrink: 0
                                        }}>
                                            <img
                                                src={fixPhotoUrl(currentPlayer.photo_url, currentPlayer.first_name)}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                alt=""
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPlayer.first_name}`;
                                                }}
                                            />
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '1.5px' }}>
                                                CURRENT PLAYER
                                            </div>
                                            <h2 style={{ fontSize: '2.2rem', fontWeight: 950, lineHeight: 1.1, margin: '4px 0 12px', color: '#fff' }}>
                                                {currentPlayer.first_name} <span style={{ color: 'var(--primary)' }}>{currentPlayer.last_name}</span>
                                            </h2>

                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                                <div style={{ padding: '5px 12px', borderRadius: '10px', background: 'rgba(255,215,0,0.1)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 900, border: '1px solid rgba(255,215,0,0.2)' }}>
                                                    {currentPlayer.cricket_skill}
                                                </div>
                                                <div style={{ padding: '5px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', fontWeight: 800 }}>
                                                    KC3: {currentPlayer.was_present_kc3}
                                                </div>
                                                <div style={{ padding: '5px 12px', borderRadius: '10px', background: 'rgba(255,215,0,0.1)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 900, border: '1px solid rgba(255,215,0,0.2)' }}>
                                                    BASE: {currentPlayer.base_price} P
                                                </div>
                                            </div>

                                            {/* Current Bid & Leader strip */}
                                            <div style={{
                                                background: 'rgba(0,0,0,0.5)',
                                                padding: '14px 18px',
                                                borderRadius: '16px',
                                                border: '1px solid rgba(255,215,0,0.2)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 800 }}>
                                                        CURRENT BID
                                                    </div>
                                                    <div style={{ fontSize: '2rem', fontWeight: 950, color: '#fff', lineHeight: 1.1 }}>
                                                        {formatPushp(auctionState.current_highest_bid || 0)}
                                                    </div>
                                                </div>
                                                {highestBidderName && (
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                                                            HIGHEST BIDDER
                                                        </div>
                                                        <div style={{
                                                            fontSize: '1.25rem',
                                                            fontWeight: 950,
                                                            color: isLeading ? '#00ff80' : 'var(--primary)'
                                                        }}>
                                                            {isLeading ? '👑 YOU ARE LEADING' : highestBidderName}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* === PRIMARY TACTILE BIDDING CONSOLE === */}
                                <div style={{
                                    background: isLeading
                                        ? 'linear-gradient(135deg, rgba(0,255,128,0.08), rgba(0,0,0,0.7))'
                                        : 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(0,0,0,0.7))',
                                    borderRadius: '22px',
                                    padding: '22px',
                                    border: isLeading
                                        ? '2px solid rgba(0,255,128,0.35)'
                                        : '2px solid rgba(255,215,0,0.3)',
                                    boxShadow: isLeading
                                        ? '0 0 35px rgba(0,255,128,0.12)'
                                        : '0 0 35px rgba(255,215,0,0.1)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Gavel size={20} color={isLeading ? '#00ff80' : 'var(--primary)'} />
                                            <span style={{ fontSize: '0.9rem', fontWeight: 950, letterSpacing: '1px' }}>
                                                QUICK BID ACTION
                                            </span>
                                        </div>
                                        <div style={{
                                            padding: '4px 14px',
                                            borderRadius: '50px',
                                            background: 'rgba(255,215,0,0.15)',
                                            fontSize: '0.85rem',
                                            fontWeight: 900,
                                            color: 'var(--primary)'
                                        }}>
                                            NEXT BID: {nextBid} PUSHP
                                        </div>
                                    </div>

                                    {/* Status Notice */}
                                    {isLeading ? (
                                        <div style={{
                                            padding: '10px 16px',
                                            borderRadius: '12px',
                                            background: 'rgba(0,255,128,0.15)',
                                            border: '1px solid rgba(0,255,128,0.3)',
                                            color: '#00ff80',
                                            fontWeight: 900,
                                            fontSize: '0.9rem',
                                            textAlign: 'center',
                                            marginBottom: '14px'
                                        }}>
                                            👑 Your team ({myTeam?.name}) is currently the HIGHEST BIDDER at {auctionState.current_highest_bid} Pushp!
                                        </div>
                                    ) : isInsufficient ? (
                                        <div style={{
                                            padding: '10px 16px',
                                            borderRadius: '12px',
                                            background: 'rgba(255,75,75,0.15)',
                                            border: '1px solid rgba(255,75,75,0.3)',
                                            color: '#ff4b4b',
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            textAlign: 'center',
                                            marginBottom: '14px'
                                        }}>
                                            ⚠️ Insufficient purse balance ({myTeam?.remaining_budget} P). Next bid requires {nextBid} P.
                                        </div>
                                    ) : isSquadFull ? (
                                        <div style={{
                                            padding: '10px 16px',
                                            borderRadius: '12px',
                                            background: 'rgba(255,75,75,0.15)',
                                            border: '1px solid rgba(255,75,75,0.3)',
                                            color: '#ff4b4b',
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            textAlign: 'center',
                                            marginBottom: '14px'
                                        }}>
                                            ⚠️ Squad full ({MAX_SQUAD_SIZE}/{MAX_SQUAD_SIZE} players).
                                        </div>
                                    ) : null}

                                    {/* BIG INSTANT 0MS BID BUTTON */}
                                    <motion.button
                                        whileHover={canBid ? { scale: 1.02 } : {}}
                                        whileTap={canBid ? { scale: 0.98 } : {}}
                                        onClick={handlePlaceBid}
                                        disabled={!canBid}
                                        style={{
                                            width: '100%',
                                            padding: '20px 25px',
                                            borderRadius: '18px',
                                            background: isLeading
                                                ? 'rgba(0, 255, 128, 0.2)'
                                                : !canBid
                                                    ? 'rgba(255, 255, 255, 0.05)'
                                                    : 'linear-gradient(135deg, #ffd700, #ff9900)',
                                            color: isLeading
                                                ? '#00ff80'
                                                : !canBid
                                                    ? 'rgba(255, 255, 255, 0.3)'
                                                    : '#000',
                                            border: isLeading
                                                ? '2px solid rgba(0, 255, 128, 0.4)'
                                                : !canBid
                                                    ? '1px solid rgba(255, 255, 255, 0.1)'
                                                    : 'none',
                                            fontSize: '1.25rem',
                                            fontWeight: 950,
                                            letterSpacing: '1px',
                                            cursor: canBid ? 'pointer' : 'not-allowed',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '12px',
                                            boxShadow: canBid
                                                ? '0 8px 30px rgba(255, 165, 0, 0.4)'
                                                : 'none',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {isBidding ? (
                                            <>
                                                <Loader2 className="animate-spin" size={22} />
                                                <span>TRANSMITTING BID...</span>
                                            </>
                                        ) : isLeading ? (
                                            <span>✓ YOUR BID IS LEADING</span>
                                        ) : isSquadFull ? (
                                            <span>SQUAD FULL ({MAX_SQUAD_SIZE}/{MAX_SQUAD_SIZE})</span>
                                        ) : isInsufficient ? (
                                            <span>PURSE LOW FOR {nextBid} P</span>
                                        ) : (
                                            <>
                                                <Gavel size={24} />
                                                <span>BID {nextBid} PUSHP</span>
                                            </>
                                        )}
                                    </motion.button>

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginTop: '12px',
                                        padding: '8px 12px',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        fontWeight: 700
                                    }}>
                                        <span>Purse: <strong style={{ color: '#fff' }}>{myTeam?.remaining_budget} P</strong></span>
                                        <span>After Bid: <strong style={{ color: isInsufficient ? '#ff4b4b' : 'var(--primary)' }}>{Math.max(0, (myTeam?.remaining_budget || 0) - nextBid)} P</strong></span>
                                        <span>Squad: <strong style={{ color: '#fff' }}>{mySquadCount}/{MAX_SQUAD_SIZE}</strong></span>
                                    </div>
                                </div>
                            </motion.div>
                        ) : auctionState?.status === 'SOLD' && currentPlayer ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass"
                                style={{
                                    padding: '50px 20px',
                                    textAlign: 'center',
                                    borderRadius: '24px',
                                    border: '1px solid rgba(0,255,128,0.3)',
                                    background: 'rgba(0,255,128,0.04)'
                                }}
                            >
                                <div style={{ fontSize: '4.5rem', marginBottom: '10px' }}>🔨</div>
                                <h2 style={{ fontSize: '2.5rem', fontWeight: 950, color: '#00ff80', margin: 0 }}>SOLD!</h2>
                                <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)', margin: '8px 0' }}>
                                    {currentPlayer.first_name} {currentPlayer.last_name} — {auctionState.current_highest_bid} Pushp
                                </p>
                                <p style={{ fontSize: '1.5rem', fontWeight: 950, color: isLeading ? '#00ff80' : 'var(--primary)', margin: 0 }}>
                                    → {isLeading ? '🎉 WON BY YOUR TEAM!' : (highestBidderName || 'Sold')}
                                </p>
                            </motion.div>
                        ) : (
                            <div className="glass" style={{ padding: '70px 20px', textAlign: 'center', borderRadius: '24px' }}>
                                <Gavel size={60} style={{ opacity: 0.2, margin: '0 auto 15px' }} />
                                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '8px' }}>AUCTION IDLE</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Admin is preparing the next player. Stay tuned!</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* RIGHT: REAL-TIME LIVE BID FEED */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div className="glass" style={{ padding: '20px', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <History size={16} color="var(--primary)" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '1px' }}>
                                    LIVE BID FEED
                                </span>
                            </div>
                            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(0,255,128,0.15)', color: '#00ff80', fontWeight: 900 }}>
                                0MS STREAM
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                            {bidHistory.length > 0 ? bidHistory.map((b, i) => {
                                const isThisMyTeam = myTeam && (b.teams?.name === myTeam.name || b.team_id === myTeam.id);
                                return (
                                    <motion.div
                                        key={b.id || i}
                                        initial={i === 0 ? { opacity: 0, x: -10 } : {}}
                                        animate={{ opacity: 1, x: 0 }}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '10px 14px',
                                            background: i === 0
                                                ? isThisMyTeam
                                                    ? 'rgba(0,255,128,0.14)'
                                                    : 'rgba(255,215,0,0.12)'
                                                : 'rgba(255,255,255,0.02)',
                                            borderRadius: '12px',
                                            fontSize: '0.85rem',
                                            border: i === 0
                                                ? isThisMyTeam
                                                    ? '1px solid rgba(0,255,128,0.35)'
                                                    : '1px solid rgba(255,215,0,0.25)'
                                                : '1px solid transparent'
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 850, color: isThisMyTeam ? '#00ff80' : '#fff' }}>
                                                {b.teams?.name || teamsMap[b.team_id] || 'Unknown'} {isThisMyTeam && '(YOU)'}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                {b.created_at ? new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                                            </span>
                                        </div>
                                        <span style={{
                                            fontWeight: 950,
                                            color: i === 0 ? (isThisMyTeam ? '#00ff80' : 'var(--primary)') : '#fff',
                                            fontSize: '1rem'
                                        }}>
                                            {b.amount} P
                                        </span>
                                    </motion.div>
                                );
                            }) : (
                                <div style={{ textAlign: 'center', padding: '35px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    No bids placed yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Rules Card */}
                    <div className="glass" style={{ padding: '16px 20px', borderRadius: '18px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '8px', letterSpacing: '1px' }}>
                            QUICK RULES
                        </div>
                        <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: 1.4 }}>
                            <li>Tap <strong>BID</strong> to raise the bid by the next stage.</li>
                            <li>Bids synchronize in real-time across all captains & admin.</li>
                            <li>Purse automatically deducts upon <strong>SOLD</strong>.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .glass { backdrop-filter: blur(20px); background: rgba(255,255,255,0.02); }
                .animate-spin { animation: spin 1s linear infinite; }
                .animate-bounce { animation: bounce 1s infinite alternate; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-4px); } }
                @media (max-width: 900px) {
                    div[style*="gridTemplateColumns: 1.3fr 1fr"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}
