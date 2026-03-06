# 🏆 KESHAV CUP 2026 - Quick Start Guide

Welcome to the **Keshav Cup Enterprise Cricket Auction System**. This system is built with Next.js 14, Supabase Realtime, and Tailwind CSS.

## 🚀 Setup Instructions

### 1. Database Configuration
Go to your [Supabase Dashboard](https://supabase.com/dashboard) and run the following script in the **SQL Editor**:
- 👉 [FINISH_LINE_SCHEMA.sql](file:///c:/project/volatile-cassini/FINISH_LINE_SCHEMA.sql)

This will create all tables, RLS policies, Realtime subscriptions, and Atomic functions (`place_bid_secure`, `sell_player_atomic`).

### 2. Environment Variables
Ensure your `.env.local` file has the following (replace with your actual Supabase project credentials):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (Required for Admin APIs)
```

### 3. Initialize Auth & Teams
Once the server is running, visit these internal APIs in your browser (one-time setup):
- **Setup Admin**: [http://localhost:3000/api/setup-admin?email=admin@keshav.com&password=admin123](http://localhost:3000/api/setup-admin?email=admin@keshav.com&password=admin123)
- **Setup Teams**: [http://localhost:3000/api/setup-teams](http://localhost:3000/api/setup-teams) (Default password is `123456789`)

---

## 🛠 Features Included

### 1. Admin Portal (`/admin`)
- **Add Player**: Integrated with Supabase Storage for player photos.
- **Auction Control**: Start auction for any player (Single-click start).
- **Official Console**: Pause, Resume, Reset, Mark as Sold, or Unsold.
- **Franchise Overview**: Live tracking of purse spent across all 8 teams.

### 2. Captain Portal (`/dashboard`)
- **Real-Time Arena**: Live updates for current player, highest bid, and bid history.
- **Bidding System**: Atomic "Place Bid" and "Mega Bid" (+1.00 Cr) buttons.
- **Strategy & Squad**: Live view of your acquired players and remaining purse.

### 3. Real-Time System
- Built using **Supabase `postgres_changes`** listener.
- Instant UI updates for **New Bid**, **Auction Start**, and **Player Sold**.
- Zero manual refresh required.

### 4. Responsive UI
- Fully compatible with **Mobile (Android/iPhone)**, **Tablets**, and **Desktops**.
- Premium aesthetics with **Glassmorphism**, **Smooth Animations (Framer Motion)**, and **Rich Gradients**.

---

## 🏗 Project Structure
- `/src/app/admin`: Admin dashboard and control center.
- `/src/app/dashboard`: Captain's live auction portal.
- `/src/components`: Reusable UI components (`AuctionRoom`, `Navbar`, etc.)
- `/src/lib/supabase.ts`: Production-ready Supabase client.
- `/FINISH_LINE_SCHEMA.sql`: Database source of truth.

---
**Jay Swaminarayan**
