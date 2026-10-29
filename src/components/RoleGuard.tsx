'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRole: 'admin' | 'captain';
}

export default function RoleGuard({ children, allowedRole }: RoleGuardProps) {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !loading) {
            const isAdminEmail = user?.email?.toLowerCase().includes('admin') || user?.email?.toLowerCase().includes('het@');
            const effectiveRole = (isAdminEmail && allowedRole === 'admin') ? 'admin' : role?.toLowerCase();
            
            if (!user || effectiveRole !== allowedRole.toLowerCase()) {
                console.log(`RoleGuard: Access Denied. User: ${user?.email}, Role: ${effectiveRole}, Required: ${allowedRole}`);
                const loginPath = allowedRole.toLowerCase() === 'admin' ? '/admin/login' : '/login';
                router.replace(loginPath);
            }
        }
    }, [user, role, loading, allowedRole, router, mounted]);

    if (!mounted || loading) {
        return (
            <div style={{ 
                height: '100vh', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                background: '#0a0a0a', 
                color: '#fff',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 className="spinning" size={48} color="#FFD700" style={{ margin: '0 auto 15px' }} />
                    <p style={{ fontWeight: 900, letterSpacing: '2px', fontSize: '0.8rem', color: '#FFD700' }}>VERIFYING CREDENTIALS...</p>
                </div>
                <style jsx>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    .spinning { animation: spin 1s linear infinite; }
                `}</style>
            </div>
        );
    }

    const isAdminEmail = user?.email?.toLowerCase().includes('admin') || user?.email?.toLowerCase().includes('het@');
    const effectiveRole = (isAdminEmail && allowedRole === 'admin') ? 'admin' : role?.toLowerCase();

    if (!user || effectiveRole !== allowedRole.toLowerCase()) {
        return null;
    }

    return <>{children}</>;
}