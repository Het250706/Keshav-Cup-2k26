-- CORRECTED CRITICAL FIX FOR TEAM LOGIN & DASHBOARD
-- Run this in your Supabase SQL Editor

-- 1. FIX TEAMS TABLE COLUMNS
ALTER TABLE teams ADD COLUMN IF NOT EXISTS remaining_budget BIGINT DEFAULT 1000000000;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS total_budget BIGINT DEFAULT 1000000000;

-- 2. SEED TEAMS (Required for login)
INSERT INTO teams (name, remaining_budget, total_budget, max_players)
VALUES 
    ('SHAURYAM', 1000000000, 1000000000, 8),
    ('DIVYAM', 1000000000, 1000000000, 8),
    ('SATYAM', 1000000000, 1000000000, 8),
    ('DASHATVAM', 1000000000, 1000000000, 8),
    ('DHAIRYAM', 1000000000, 1000000000, 8),
    ('GYANAM', 1000000000, 1000000000, 8),
    ('AISHWARYAM', 1000000000, 1000000000, 8),
    ('ASTIKAYAM', 1000000000, 1000000000, 8)
ON CONFLICT (name) DO UPDATE SET 
    remaining_budget = EXCLUDED.remaining_budget,
    total_budget = EXCLUDED.total_budget;

-- 3. ENSURE AUCTION_STATE TABLE EXISTS AND IS INITIALIZED
CREATE TABLE IF NOT EXISTS auction_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    status TEXT DEFAULT 'idle',
    current_player_id UUID REFERENCES players(id),
    timer_remaining INTEGER DEFAULT 30,
    current_highest_bid BIGINT DEFAULT 0,
    last_bid_team_id UUID REFERENCES teams(id),
    bid_increment BIGINT DEFAULT 1000000
);

INSERT INTO auction_state (id, status) 
VALUES (1, 'idle') 
ON CONFLICT (id) DO NOTHING;

-- 4. ENABLE REALTIME FOR EVERYTHING (Safely)
DO $$ 
BEGIN 
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE teams;
    EXCEPTION WHEN OTHERS THEN 
        NULL; -- Ignore if already added
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE players;
    EXCEPTION WHEN OTHERS THEN 
        NULL; -- Ignore if already added
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
    EXCEPTION WHEN OTHERS THEN 
        NULL; -- Ignore if already added
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE bids;
    EXCEPTION WHEN OTHERS THEN 
        NULL; -- Ignore if already added
    END;
END $$;
