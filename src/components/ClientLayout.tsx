'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import NotificationSystem from '@/components/NotificationSystem';
import CreditBanner from '@/components/CreditBanner';
import { AuthProvider } from '@/components/AuthProvider';

/**
 * ClientLayout component to wrap the application with necessary context providers
 * and global UI elements like Navbar, Notifications, and the Credit Banner.
 * This ensures consistent branding and functionality across the entire Keshav Cup platform.
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Navbar />
      <main style={{ minHeight: '100vh', paddingTop: '80px' }}>
        {children}
      </main>
      <NotificationSystem />
      <CreditBanner />
    </AuthProvider>
  );
}
