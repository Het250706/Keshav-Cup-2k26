'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRole: 'admin' | 'captain';
}

export default function RoleGuard({ children, allowedRole }: RoleGuardProps) {
    const { user, role, loading } = useAuth();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        const checkAccess = () => {
            const loginPath = allowedRole === 'admin' ? '/admin/login' : '/login';

            if (!user) {
                setIsAuthorized(false);
                window.location.href = loginPath;
                return;
            }

            const userRole = role?.toLowerCase();
            const targetRole = allowedRole.toLowerCase();

            // Logic: Admin can access everything, Captain only captain routes
            const hasAccess = userRole === 'admin' || userRole === targetRole;

            if (hasAccess) {
                setIsAuthorized(true);
            } else {
                setIsAuthorized(false);
                window.location.href = userRole === 'admin' ? '/admin/dashboard' : '/captain/dashboard';
            }
        };

        checkAccess();
    }, [allowedRole, user, role, loading]);

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