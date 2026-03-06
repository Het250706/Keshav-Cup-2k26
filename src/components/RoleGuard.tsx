'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRole: 'admin' | 'captain';
}

export default function RoleGuard({ children, allowedRole }: RoleGuardProps) {
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;

        async function checkAccess() {
            try {
                // Determine redirect path based on requested role
                const loginPath = allowedRole === 'admin' ? '/admin/login' : '/login';

                // SAFE METHOD: Use getUser() instead of getSession() to avoid lock "steal" conflicts.
                // getUser() is also more secure as it always validates with the server.
                const { data: { user }, error: authError } = await supabase.auth.getUser();

                if (authError || !user) {
                    if (isMounted) {
                        setIsAuthorized(false);
                        // Using window.location for a clean redirect if auth fails
                        window.location.href = loginPath;
                    }
                    return;
                }

                // Query role verification
                const { data: roleData, error: roleError } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', user.id)
                    .single();

                if (roleError || !roleData) {
                    if (isMounted) {
                        setIsAuthorized(false);
                        window.location.href = loginPath;
                    }
                    return;
                }

                const userRole = roleData.role.toLowerCase();
                const targetRole = allowedRole.toLowerCase();

                // Logic: Admin can access everything, Captain only captain routes
                const hasAccess = userRole === 'admin' || userRole === targetRole;

                if (isMounted) {
                    if (hasAccess) {
                        setIsAuthorized(true);
                    } else {
                        setIsAuthorized(false);
                        window.location.href = userRole === 'admin' ? '/admin/dashboard' : '/captain/dashboard';
                    }
                }
            } catch (err: any) {
                // Silently handle AbortError and retry or redirect
                if (err.name === 'AbortError') return;

                console.error('RoleGuard Error:', err);
                if (isMounted) {
                    setIsAuthorized(false);
                    window.location.href = allowedRole === 'admin' ? '/admin/login' : '/login';
                }
            }
        }

        checkAccess();

        return () => {
            isMounted = false;
        };
    }, [allowedRole, router]);

    if (isAuthorized === null) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#000',
                color: '#fff'
            }}>
                <Loader2 className="animate-spin" size={48} color="var(--primary)" />
                <p style={{ marginTop: '20px', fontWeight: 600, letterSpacing: '1px' }}>SECURITY VERIFICATION...</p>
                <style jsx>{`
                    .animate-spin { animation: spin 1s linear infinite; }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    return isAuthorized ? <>{children}</> : null;
}