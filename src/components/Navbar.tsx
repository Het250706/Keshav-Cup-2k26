import Link from 'next/link';
import { LayoutDashboard, Zap, ScrollText, Shield, PieChart, Users, History as HistoryIcon, User as UserIcon, LogOut, Menu, X, Trophy, History, UserCheck, Trash2, Gavel, UserPlus, Shuffle, FileText, Download, Link as LinkIcon, FileSpreadsheet, ExternalLink, Settings, LayoutGrid } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, role, loading } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            // Properly clear Supabase session
            await supabase.auth.signOut();

            // Clear all local and session storage to prevent residual data
            if (typeof window !== 'undefined') {
                localStorage.clear();
                sessionStorage.clear();

                // Clear all cookies manually for extra safety
                const cookies = document.cookie.split(";");
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i];
                    const eqPos = cookie.indexOf("=");
                    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
                    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                }
            }

            setIsMenuOpen(false);

            // Clean redirect to root - use window.location.replace for full state clear
            window.location.replace('/');
        } catch (err) {
            console.error('Logout error:', err);
            window.location.replace('/');
        }
    };

    const getNavLinkStyle = (path: string) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: pathname === path ? 'var(--primary)' : 'var(--text-muted)',
        fontWeight: 600,
        transition: 'all 0.3s ease',
        fontSize: '0.95rem'
    });

    const NavItems = () => (
        <>
            <Link href="/" style={getNavLinkStyle('/')} onClick={() => setIsMenuOpen(false)}>
                <span>Home</span>
            </Link>

            {role === 'captain' && (
                <Link href="/captain/dashboard" style={getNavLinkStyle('/captain/dashboard')} onClick={() => setIsMenuOpen(false)}>
                    <LayoutDashboard size={18} />
                    <span>Dashboard</span>
                </Link>
            )}



            {role === 'admin' && (
                <>
                    <Link href="/admin/dashboard" style={getNavLinkStyle('/admin/dashboard')} onClick={() => setIsMenuOpen(false)}>
                        <Shield size={18} />
                        <span>Admin Panel</span>
                    </Link>

                    <Link href="/analytics" style={getNavLinkStyle('/analytics')} onClick={() => setIsMenuOpen(false)}>
                        <PieChart size={18} />
                        <span>Analytics</span>
                    </Link>

                    <Link href="/teams" style={getNavLinkStyle('/teams')} onClick={() => setIsMenuOpen(false)}>
                        <Users size={18} />
                        <span>Team Squads</span>
                    </Link>

                    <Link href="/auction-history" style={getNavLinkStyle('/auction-history')} onClick={() => setIsMenuOpen(false)}>
                        <HistoryIcon size={18} />
                        <span>History</span>
                    </Link>
                </>
            )}

            {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', border: '1px solid var(--border)' }}>
                        <UserIcon size={16} color="var(--primary)" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                            {user.user_metadata?.team_name || (role === 'admin' ? 'Administrator' : 'User')}
                        </span>
                    </div>
                    {role === 'admin' && (
                        <Link href="/login" style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800, textDecoration: 'none', borderBottom: '1px dashed var(--primary)', paddingBottom: '2px' }}>
                            CAPTAIN LOGIN
                        </Link>
                    )}
                    <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 15px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', border: '1px solid #ff4b4b', color: '#ff4b4b' }}>
                        <LogOut size={16} />
                        <span className="desktop-only">Logout</span>
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Link href="/login" className="btn-primary" style={{ padding: '8px 24px', borderRadius: '25px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsMenuOpen(false)}>
                        <UserIcon size={18} />
                        <span>Portal Login</span>
                    </Link>
                </div>
            )}
        </>
    );

    return (
        <nav className="glass" style={{
            margin: '15px',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: '15px',
            zIndex: 1000,
            border: '1px solid rgba(255, 215, 0, 0.2)'
        }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    background: 'var(--primary)',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 15px var(--primary-glow)'
                }}>
                    <Trophy size={20} color="#000" strokeWidth={2.5} />
                </div>
                <span className="title-gradient" style={{ fontSize: '1.2rem', letterSpacing: '1px', fontWeight: 900 }}>KESHAV CUP</span>
            </Link>

            {/* Desktop Menu */}
            <div className="desktop-only" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <NavItems />
            </div>

            {/* Mobile Menu Toggle */}
            <button
                className="mobile-only"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                style={{ color: 'var(--primary)', padding: '5px' }}
            >
                {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.98)',
                            backdropFilter: 'blur(20px)',
                            padding: '30px',
                            marginTop: '10px',
                            borderRadius: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '20px',
                            border: '1px solid var(--border)',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
                        }}
                    >
                        <NavItems />
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}

