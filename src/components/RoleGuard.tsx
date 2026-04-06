'use client';

import { useEffect } from 'react';
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

    useEffect(() => {
        if (!loading) {
            const currentRole = role?.toLowerCase();
            if (!user || currentRole !== allowedRole.toLowerCase()) {
                console.log(`RoleGuard: Access Denied. User: ${user?.email}, Role: ${currentRole}, Required: ${allowedRole}`);
                // REDIRECT to the correct login page based on the required role
                const loginPath = allowedRole.toLowerCase() === 'admin' ? '/admin/login' : '/login';
                router.push(loginPath);
            }
        }
    }, [user, role, loading, allowedRole, router]);

    if (loading) {
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

    if (!user || role?.toLowerCase() !== allowedRole.toLowerCase()) {
        return null;
    }

    return <>{children}</>;
}