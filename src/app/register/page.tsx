'use client';

import { motion } from 'framer-motion';
import { Trophy, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import RegistrationForm from '@/components/RegistrationForm';

export default function PlayerRegistration() {
    return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff', overflowX: 'hidden' }}>
            {/* Header / Navigation */}
            <nav className="glass" style={{
                margin: '15px',
                padding: '12px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: '15px',
                zIndex: 1000,
                borderRadius: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--primary)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trophy size={18} color="#000" strokeWidth={3} />
                    </div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 950, letterSpacing: '1px' }}>KESHAV CUP</span>
                </div>
                <Link href="/" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 700
                }}>
                    <ArrowLeft size={16} /> BACK HOME
                </Link>
            </nav>

            <div className="container" style={{ maxWidth: '900px', margin: '40px auto', padding: '0 15px' }}>
                {/* Intro Section */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="title-gradient"
                        style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: 950, letterSpacing: '-2px', marginBottom: '10px' }}
                    >
                        OFFICIAL REGISTRATION
                    </motion.h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 600 }}>Join the Keshav Cup 2026 Player Pool</p>
                </div>

                {/* Custom Registration Form Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="glass"
                    style={{
                        borderRadius: '32px',
                        overflow: 'hidden',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 215, 0, 0.1)',
                        minHeight: '600px',
                        position: 'relative',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}
                >
                    <RegistrationForm />
                </motion.div>

                {/* Footer Info */}
                <div style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '60px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Facing issues? <a href="mailto:support@keshavcup.com" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Contact Support</a>
                    </p>
                </div>
            </div>

            <style jsx global>{`
                :root {
                    --bg: #000;
                    --primary: #FFD700;
                    --primary-glow: rgba(255, 215, 0, 0.4);
                    --border: rgba(255, 255, 255, 0.1);
                    --text-muted: #888;
                }
                body { background: #000; font-family: 'Outfit', sans-serif; margin: 0; padding: 0; }
                .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); border: 1px solid var(--border); }
                .title-gradient { background: linear-gradient(135deg, #fff 0%, #FFD700 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                
                .btn-primary {
                    background: var(--primary);
                    color: #000;
                    border: none;
                    border-radius: 12px;
                    text-decoration: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 0 20px var(--primary-glow);
                }
                .btn-primary:hover { transform: scale(1.02); filter: brightness(1.1); }
                
                .btn-secondary {
                    background: rgba(255,255,255,0.05);
                    color: #fff;
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    text-decoration: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .btn-secondary:hover { background: rgba(255,255,255,0.1); }

                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: #000; }
                ::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: #333; }

                input:focus, select:focus {
                    border-color: var(--primary) !important;
                    background: rgba(255,215,0,0.03) !important;
                }
            `}</style>
        </main>
    );
}
