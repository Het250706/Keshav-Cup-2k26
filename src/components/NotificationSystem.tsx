'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Info, CheckCircle, AlertCircle } from 'lucide-react';

interface Notification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warn';
    team?: string;
}

export default function NotificationSystem() {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        const bidSub = supabase.channel('notif-bids')
            .on('postgres_changes', { event: 'INSERT', table: 'bids', schema: 'public' }, async (payload: any) => {
                // Get team name
                const { data: team } = await supabase.from('teams').select('name').eq('id', payload.new.team_id).single();
                const { data: player } = await supabase.from('players').select('name').eq('id', payload.new.player_id).single();

                addNotification({
                    id: payload.new.id,
                    message: `${team?.name} bid ₹ ${(payload.new.amount / 10000000).toFixed(2)} Cr for ${player?.name}`,
                    type: 'info',
                    team: team?.name
                });

                // Play bid sound
                playBidSound();
            })
            .on('postgres_changes', { event: 'UPDATE', table: 'players', schema: 'public' }, async (payload: any) => {
                if (payload.new.is_sold && !payload.old.is_sold) {
                    const { data: team } = await supabase.from('teams').select('name').eq('id', payload.new.team_id).single();
                    addNotification({
                        id: payload.new.id,
                        message: `🔨 SOLD! ${payload.new.name} to ${team?.name} for ₹ ${(payload.new.sold_price / 10000000).toFixed(2)} Cr`,
                        type: 'success'
                    });
                    playHammerSound();
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(bidSub); };
    }, []);

    const addNotification = (notif: Notification) => {
        setNotifications(prev => [notif, ...prev].slice(0, 5));
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
        }, 5000);
    };

    const playBidSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'); // Light click/ping
        audio.play().catch(() => { });
    };

    const playHammerSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2040/2040-preview.mp3'); // Hammer/Wood hit
        audio.play().catch(() => { });
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none'
        }}>
            <AnimatePresence>
                {notifications.map((n) => (
                    <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                        className="glass"
                        style={{
                            padding: '15px 20px',
                            minWidth: '300px',
                            maxWidth: '400px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            background: n.type === 'success' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(0, 75, 160, 0.8)',
                            border: `1px solid ${n.type === 'success' ? '#00ff00' : 'var(--primary)'}`,
                            pointerEvents: 'auto',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                        }}
                    >
                        {n.type === 'success' ? <CheckCircle color="#00ff00" size={20} /> : <CheckCircle color="var(--primary)" size={20} />}
                        <div style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600 }}>{n.message}</div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
