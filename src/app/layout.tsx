import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "IPL Cricket Auction | Real-Time Bidding",
  description: "The ultimate real-time cricket auction platform. Bid on your favorite players and build your dream team.",
};

import NotificationSystem from '@/components/NotificationSystem';
import type { Metadata } from 'next';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        {children}
        <NotificationSystem />
      </body>
    </html>
  );
}
