'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

// ALLOWED ADMIN EMAILS - Configurable as requested
const ALLOWED_ADMINS = [
    'admin@keshav.com',
    'het@keshav.com'
];

export default function AdminLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { user: authUser, role: authRole, loading: authLoading } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const loginEmail = email.trim();
        const loginPassword = password.trim();

        // 1. Check Allowed Admin Emails
        if (!ALLOWED_ADMINS.includes(loginEmail.toLowerCase())) {
            setError('Access Denied: This email is not authorized for Admin access.');
            setLoading(false);
            return;
        }

        try {
            // 2. Sign in via Supabase
            let { data, error: authError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: loginPassword,
            });

            // FALLBACK: Server-side check if client-side fails
            if (authError) {
                console.log('Client-side sign in failed, trying server API fallback...');
                try {
                    const loginRes = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: loginEmail, password: loginPassword })
                    });

                    if (loginRes.ok) {
                        const loginData = await loginRes.json();
                        if (loginData.session) {
                            const { error: sessionError } = await supabase.auth.setSession(loginData.session);
                            if (!sessionError) {
                                authError = null;
                                data = { user: loginData.user, session: loginData.session };
                            }
                        }
                    }
                } catch (fallbackErr) {
                    console.error('API fallback failed:', fallbackErr);
                }
            }

            if (authError) {
                if (authError.message.toLowerCase().includes('invalid login credentials')) {
                    throw new Error('Incorrect credentials. Please check your admin email and password.');
                }
                throw authError;
            }

            if (!data?.user) throw new Error('Authentication failed');

            // 3. Verify Admin Role in Database
            let isVerifiedAdmin = false;
            try {
                const { data: roleData } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', data.user.id)
                    .single();

                if (roleData && roleData.role?.toLowerCase() === 'admin') {
                    isVerifiedAdmin = true;
                }
            } catch (_) {}

            if (!isVerifiedAdmin && ALLOWED_ADMINS.includes(loginEmail.toLowerCase())) {
                isVerifiedAdmin = true;
            }

            if (!isVerifiedAdmin) {
                await supabase.auth.signOut();
                throw new Error('Access Denied: Your account does not have Administrator privileges.');
            }

            // Store session and role immediately into storage so RoleGuard is satisfied instantly
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem('kc_cached_user', JSON.stringify(data.user));
                    localStorage.setItem('kc_cached_user_id', data.user.id);
                    localStorage.setItem('kc_cached_role', 'admin');
                    sessionStorage.setItem('kc_cached_role', 'admin');
                } catch (_) {}
            }

            // SUCCESS Redirect to Admin Dashboard
            window.location.href = '/admin/dashboard';

        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass" style={{
                width: 'min(480px, 92%)',
                padding: '50px',
                margin: '20px',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '24px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{
                        width: '100px',
                        height: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 25px',
                    }}>
                        <img 
                            src="/logo.png" 
                            alt="Logo" 
                            style={{ width: '100%', height: 'auto' }} 
                        />
                    </div>
                    <h1 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '12px', fontWeight: 950, letterSpacing: '-1px' }}>
                        ADMIN LOGIN
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Secure Infrastructure Access</p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(255, 75, 75, 0.1)',
                        color: '#ff4b4b',
                        padding: '15px',
                        borderRadius: '12px',
                        marginBottom: '25px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '0.9rem',
                        border: '1px solid rgba(255, 75, 75, 0.3)'
                    }}>
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>ADMIN EMAIL</label>
                        <div style={{ position: 'relative' }}>
                            <Mail style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@keshav.com"
                                style={inputStyle}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>PASSWORD</label>
                        <div style={{ position: 'relative' }}>
                            <Lock style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{ ...inputStyle, paddingRight: '50px' }}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '16px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '18px', fontSize: '1.1rem', marginTop: '10px', fontWeight: 900 }}>
                        {loading ? <Loader2 className="animate-spin" size={24} /> : 'INITIALIZE ACCESS'}
                    </button>

                </form>
            </div>

            <style jsx>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </main>
    );
}

const inputStyle = {
    width: '100%',
    padding: '16px 16px 16px 52px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    transition: 'all 0.3s ease',
};
