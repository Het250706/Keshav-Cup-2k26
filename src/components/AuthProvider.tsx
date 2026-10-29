'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    role: string | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    loading: true,
    refresh: async () => { },
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchUser = async (retryCount = 0) => {
        try {
            // Fast-path: read existing session from local storage immediately
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session?.user) {
                const sessionUser = sessionData.session.user;
                setUser(sessionUser);

                // Determine role accurately from sessionUser itself
                const isEmailAdmin = sessionUser.email?.toLowerCase().includes('admin') || sessionUser.email?.toLowerCase().includes('het@');
                const metaRole = sessionUser.user_metadata?.role?.toLowerCase();
                const determinedRole = isEmailAdmin ? 'admin' : (metaRole || 'captain');

                setRole(determinedRole);
                setLoading(false); // Instant unlock

                if (typeof window !== 'undefined') {
                    try {
                        localStorage.setItem('kc_cached_user', JSON.stringify(sessionUser));
                        localStorage.setItem('kc_cached_user_id', sessionUser.id);
                        localStorage.setItem('kc_cached_role', determinedRole);
                        sessionStorage.setItem('kc_cached_role', determinedRole);
                    } catch (_) {}
                }
            }

            // Verify with server in background
            const { data, error } = await supabase.auth.getUser();

            if (error) {
                if (error.name === 'AbortError' || error.message?.includes('Lock broken')) {
                    if (retryCount < 2) {
                        setTimeout(() => fetchUser(retryCount + 1), 500);
                        return;
                    }
                }

                if (
                    error.message?.includes('Refresh Token') ||
                    error.message?.includes('invalid_grant') ||
                    (error as any).status === 400
                ) {
                    try { await supabase.auth.signOut(); } catch (_) {}
                }

                setUser(null);
                setRole(null);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('kc_cached_user');
                    localStorage.removeItem('kc_cached_role');
                    sessionStorage.removeItem('kc_cached_role');
                }
            } else {
                const currentUser = data?.user || null;
                setUser(currentUser);

                if (currentUser) {
                    try {
                        const { data: roleData } = await supabase
                            .from('user_roles')
                            .select('role')
                            .eq('user_id', currentUser.id)
                            .single();
                        const isEmailAdmin = currentUser.email?.toLowerCase().includes('admin') || currentUser.email?.toLowerCase().includes('het@');
                        const rawRole = isEmailAdmin ? 'admin' : (roleData?.role || currentUser.user_metadata?.role || 'captain');
                        const finalRole = rawRole.toLowerCase();
                        setRole(finalRole);
                        if (typeof window !== 'undefined' && finalRole) {
                            localStorage.setItem('kc_cached_user', JSON.stringify(currentUser));
                            localStorage.setItem('kc_cached_user_id', currentUser.id);
                            localStorage.setItem('kc_cached_role', finalRole);
                            sessionStorage.setItem('kc_cached_role', finalRole);
                        }
                    } catch {
                        // Keep current role
                    }
                } else {
                    setRole(null);
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('kc_cached_user');
                        localStorage.removeItem('kc_cached_user_id');
                        localStorage.removeItem('kc_cached_role');
                        sessionStorage.removeItem('kc_cached_role');
                    }
                }
            }
        } catch (err) {
            console.error('Auth Context Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const u = localStorage.getItem('kc_cached_user');
                const r = localStorage.getItem('kc_cached_role') || sessionStorage.getItem('kc_cached_role');
                if (u && r) {
                    setUser(JSON.parse(u));
                    setRole(r.toLowerCase());
                    setLoading(false);
                }
            } catch (_) {}
        }

        fetchUser();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session?.user) {
                    setUser(session.user);
                    const isEmailAdmin = session.user.email?.toLowerCase().includes('admin') || session.user.email?.toLowerCase().includes('het@');
                    const rawR = isEmailAdmin ? 'admin' : (session.user.user_metadata?.role || 'captain');
                    const r = rawR.toLowerCase();
                    setRole(r);
                    setLoading(false);
                    if (typeof window !== 'undefined') {
                        try {
                            localStorage.setItem('kc_cached_user', JSON.stringify(session.user));
                            localStorage.setItem('kc_cached_user_id', session.user.id);
                            localStorage.setItem('kc_cached_role', r);
                        } catch (_) {}
                    }
                }
                fetchUser();
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setRole(null);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('kc_cached_user');
                    localStorage.removeItem('kc_cached_user_id');
                    localStorage.removeItem('kc_cached_role');
                    sessionStorage.removeItem('kc_cached_role');
                }
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, role, loading, refresh: fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
