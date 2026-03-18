# Keshav Cup 4.0 - Cricket Auction Web App

## Overview
A real-time cricket auction web app built for BAPS Petlad Yuva.
Features player registration, live auction bidding, team management,
and admin controls.

## Tech Stack
- Next.js 14 (App Router)
- Supabase (Database + Realtime + Storage)
- Vercel (Deployment)
- Tailwind CSS + Framer Motion

## Features
- Player Registration Form (/register)
- Admin Registration Control
- Live Auction Screen (Big Screen)
- Captain Auction View (Read-only)
- Player Pool Management
- Team Squad Management
- Analytics Dashboard
- Google Sheets Integration (auto-sync on registration)

## Environment Variables
Create a .env.local file with:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="your_private_key"
GOOGLE_SHEET_ID=your_google_sheet_id
```

## Getting Started
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Registration Flow
1. Player visits /register
2. Fills form with personal + cricket details
3. Uploads photo (stored in Supabase Storage)
4. Data saved to Supabase + Google Sheets automatically

## Auction Flow
1. Admin pushes players from Registration Control to Player Pool
2. Admin starts auction for each player
3. Captains bid in real-time
4. Admin marks player as Sold/Unsold

## Deployment
Deployed on Vercel. Connect GitHub repo and add environment variables.

## Important Notes
- Never commit .env file to GitHub
- Google Service Account JSON key must be kept private
- Supabase Service Role Key must be kept private
