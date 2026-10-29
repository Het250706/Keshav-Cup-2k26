'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Info, CheckCircle, AlertCircle, TrendingUp, Hammer } from 'lucide-react';
import { playBidSound, playHammerSound } from '@/lib/audio';

interface Notification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warn' | 'bid';
    team?: string;
    playerName?: string;
}

export default function NotificationSystem() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const teamsMapRef = useRef<Record<string, string>>({});

    useEffect(() => {
        // Pre-cache all teams once into memory (0ms lookup)
        supabase.from('teams').select('id, name').then(({ data }) => {
            if (data) {
                const map: Record<string, string> = {};
                data.forEach((t: any) => { map[t.id] = t.name; });
                teamsMapRef.current = map;
            }
        });

        const channel = supabase.channel('notif-system')
            .on('postgres_changes', { event: 'INSERT', table: 'bids', schema: 'public' }, (payload: any) => {
                const teamName = teamsMapRef.current[payload.new.team_id] || 'A Franchise';

                addNotification({
                    id: payload.new.id,
                    message: `${teamName} bid ${payload.new.amount} Pushp`,
                    type: 'bid',
                    team: teamName
                });

                playBidSound();
            })
            .on('postgres_changes', { event: 'UPDATE', table: 'players', schema: 'public' }, (payload: any) => {
                // If player status changed to 'sold'
                if (payload.new.auction_status === 'sold' && payload.old?.auction_status !== 'sold') {
                    addNotification({
                        id: `sold-${payload.new.id}`,
                        message: `🔨 SOLD! ${payload.new.first_name} ${payload.new.last_name} to ${payload.new.sold_team || 'Team'}`,
                        type: 'success'
                    });
                    playHammerSound();
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const addNotification = (notif: Notification) => {
        setNotifications(prev => [notif, ...prev].slice(0, 5));
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
        }, 5000);
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'none'
        }}>
            <AnimatePresence>
                {notifications.map((n) => (
                    <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 100, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                        style={{
                            padding: '16px 24px',
                            minWidth: '320px',
                            maxWidth: '450px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            background: n.type === 'success' ? 'rgba(255, 50, 50, 0.95)' :
                                n.type === 'bid' ? 'rgba(255, 215, 0, 0.95)' : 'rgba(0, 150, 255, 0.95)',
                            color: n.type === 'bid' ? '#000' : '#fff',
                            borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            pointerEvents: 'auto',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                            backdropFilter: 'blur(10px)'
                        }}
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {n.type === 'success' ? <Hammer size={20} /> :
                                n.type === 'bid' ? <TrendingUp size={20} /> : <Bell size={20} />}
                        </div>
                        <div style={{ flex: 1 }}>
                            {n.playerName && <div style={{ fontSize: '0.7rem', fontWeight: 900, opacity: 0.8, textTransform: 'uppercase', marginBottom: '2px' }}>{n.playerName}</div>}
                            <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{n.message}</div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
