-- SECURE & FAST Bidding Function
-- This runs as a single transaction on the server, preventing race conditions.

CREATE OR REPLACE FUNCTION place_bid_secure(
    p_player_id UUID,
    p_team_id UUID,
    p_amount BIGINT
) 
RETURNS JSONB AS $$
DECLARE
    v_current_highest BIGINT;
    v_base_price BIGINT;
    v_budget BIGINT;
    v_team_name TEXT;
    v_auction_status TEXT;
BEGIN
    -- 1. Get State & Player Info with Row Locking
    -- We lock the auction_state row for ID 1 to ensure only one bid is processed at a time
    SELECT current_highest_bid INTO v_current_highest
    FROM auction_state
    WHERE id = 1
    FOR UPDATE;

    SELECT base_price, auction_status INTO v_base_price, v_auction_status
    FROM players
    WHERE id = p_player_id;

    -- 2. Validate Auction Status
    IF v_auction_status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction is not active for this player');
    END IF;

    -- 3. Validate Bid Amount
    -- If it's the first bid (current=0), it must be at least base_price
    -- Otherwise, it must be strictly higher than current
    IF v_current_highest = 0 THEN
        IF p_amount < v_base_price THEN
            RETURN jsonb_build_object('success', false, 'error', 'Opening bid must be at least ' || v_base_price);
        END IF;
    ELSE
        IF p_amount <= v_current_highest THEN
            RETURN jsonb_build_object('success', false, 'error', 'Bid must be higher than current highest: ' || v_current_highest);
        END IF;
    END IF;

    -- 4. Check Team Budget
    SELECT remaining_budget, name INTO v_budget, v_team_name
    FROM teams
    WHERE id = p_team_id;

    IF v_budget IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Team not found');
    END IF;

    IF v_budget < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient budget for ' || v_team_name);
    END IF;

    -- 5. Atomic Update
    -- Insert into history
    INSERT INTO bids (player_id, team_id, amount)
    VALUES (p_player_id, p_team_id, p_amount);

    -- Update central state
    UPDATE auction_state
    SET current_highest_bid = p_amount,
        last_bid_team_id = p_team_id
    WHERE id = 1;

    RETURN jsonb_build_object(
        'success', true, 
        'amount', p_amount, 
        'team_name', v_team_name
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
