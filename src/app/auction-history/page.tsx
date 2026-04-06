import { Suspense } from "react";
import Navbar from '@/components/Navbar';
import AuctionHistoryTable from '@/components/auction-history/AuctionHistoryTable';
import RoleGuard from '@/components/RoleGuard';

export const dynamic = "force-dynamic";

function AuctionHistoryContent() {
    return (
        <RoleGuard allowedRole="admin">
            <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
                <div className="container-responsive" style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
                    
                    <Navbar />

                    <div style={{ marginBottom: '50px' }}>
                        <h1 className="title-gradient" style={{ fontSize: '3rem', fontWeight: 950, marginBottom: '10px' }}>
                            AUCTION HISTORY
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '2px' }}>
                            HALL OF FAME & ACQUISITION LOG
                        </p>
                    </div>

                    <AuctionHistoryTable />
                </div>
            </main>
        </RoleGuard>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div style={{ color: "white", padding: 20 }}>Loading...</div>}>
            <AuctionHistoryContent />
        </Suspense>
    );
}