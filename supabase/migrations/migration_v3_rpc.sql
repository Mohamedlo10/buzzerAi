-- =============================================================================
-- Migration V3: RPC Functions for Performance Optimization
-- Eliminates frontend mapping and reduces query count
-- =============================================================================

-- =============================================================================
-- RPC 1: get_session_players
-- Returns players with camelCase column aliases - no frontend mapping needed
-- =============================================================================
CREATE OR REPLACE FUNCTION get_session_players(p_session_id UUID)
RETURNS TABLE (
    "id" TEXT,
    "name" TEXT,
    "categories" JSONB,
    "score" INTEGER,
    "categoryScores" JSONB,
    "isManager" BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.local_id AS "id",
        p.name AS "name",
        COALESCE(p.categories, '[]'::jsonb) AS "categories",
        COALESCE(p.score, 0) AS "score",
        COALESCE(p.category_scores, '{}'::jsonb) AS "categoryScores",
        p.is_manager AS "isManager"
    FROM players p
    WHERE p.session_id = p_session_id
    ORDER BY p.joined_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_session_players(UUID) TO anon, authenticated;

-- =============================================================================
-- RPC 2: get_buzz_state
-- Returns buzzes with pre-calculated timeDiffMs using window functions
-- Eliminates client-side computation
-- =============================================================================
CREATE OR REPLACE FUNCTION get_buzz_state(p_session_id UUID)
RETURNS TABLE (
    "playerId" TEXT,
    "timestamp" BIGINT,
    "timestampMs" BIGINT,
    "timeDiffMs" BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH ordered_buzzes AS (
        SELECT
            b.player_local_id,
            EXTRACT(EPOCH FROM b.created_at)::BIGINT * 1000 AS ts,
            COALESCE(b.buzz_timestamp_ms, EXTRACT(EPOCH FROM b.created_at)::BIGINT * 1000) AS ts_ms
        FROM buzzes b
        WHERE b.session_id = p_session_id
        ORDER BY COALESCE(b.buzz_timestamp_ms, EXTRACT(EPOCH FROM b.created_at)::BIGINT * 1000) ASC
    ),
    with_first AS (
        SELECT
            ob.*,
            first_value(ob.ts_ms) OVER (ORDER BY ob.ts_ms ASC) AS first_ts_ms
        FROM ordered_buzzes ob
    )
    SELECT
        wf.player_local_id AS "playerId",
        wf.ts AS "timestamp",
        wf.ts_ms AS "timestampMs",
        (wf.ts_ms - wf.first_ts_ms) AS "timeDiffMs"
    FROM with_first wf
    ORDER BY wf.ts_ms ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_buzz_state(UUID) TO anon, authenticated;

-- =============================================================================
-- RPC 3: validate_answer
-- Atomic transaction: update score + category_scores + delete buzz + advance question
-- Returns new state for optimistic UI updates
-- =============================================================================
CREATE OR REPLACE FUNCTION validate_answer(
    p_session_id UUID,
    p_player_id TEXT,
    p_points INTEGER,
    p_category TEXT,
    p_move_next BOOLEAN,
    p_questions_count INTEGER
)
RETURNS TABLE (
    "success" BOOLEAN,
    "newQuestionIndex" INTEGER,
    "isGameOver" BOOLEAN,
    "newStatus" TEXT,
    "playerNewScore" INTEGER,
    "playerNewCategoryScores" JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_index INTEGER;
    v_next_index INTEGER;
    v_is_game_over BOOLEAN := FALSE;
    v_new_status TEXT;
    v_new_score INTEGER := 0;
    v_new_cat_scores JSONB := '{}'::jsonb;
BEGIN
    -- Get current question index
    SELECT current_question_index INTO v_current_index
    FROM sessions
    WHERE id = p_session_id;

    v_next_index := v_current_index;
    v_new_status := 'PLAYING';

    -- Update player score if player_id provided and points != 0
    IF p_player_id IS NOT NULL AND p_points != 0 THEN
        UPDATE players
        SET
            score = score + p_points,
            category_scores = CASE
                WHEN p_points > 0 AND p_category IS NOT NULL AND p_category != '' THEN
                    jsonb_set(
                        COALESCE(category_scores, '{}'::jsonb),
                        ARRAY[p_category],
                        to_jsonb(COALESCE((category_scores->>p_category)::INTEGER, 0) + 1)
                    )
                ELSE COALESCE(category_scores, '{}'::jsonb)
            END
        WHERE session_id = p_session_id AND local_id = p_player_id
        RETURNING score, category_scores INTO v_new_score, v_new_cat_scores;
    END IF;

    -- Handle buzz deletion and question advancement
    IF p_move_next THEN
        -- Correct answer: delete ALL buzzes and advance
        DELETE FROM buzzes WHERE session_id = p_session_id;

        v_next_index := v_current_index + 1;
        v_is_game_over := v_next_index >= p_questions_count;
        v_new_status := CASE WHEN v_is_game_over THEN 'RESULTS' ELSE 'PLAYING' END;

        UPDATE sessions
        SET
            current_question_index = v_next_index,
            status = v_new_status
        WHERE id = p_session_id;
    ELSIF p_player_id IS NOT NULL THEN
        -- Wrong answer: delete only this player's buzz
        DELETE FROM buzzes
        WHERE session_id = p_session_id AND player_local_id = p_player_id;
    END IF;

    RETURN QUERY SELECT
        TRUE AS "success",
        v_next_index AS "newQuestionIndex",
        v_is_game_over AS "isGameOver",
        v_new_status AS "newStatus",
        v_new_score AS "playerNewScore",
        COALESCE(v_new_cat_scores, '{}'::jsonb) AS "playerNewCategoryScores";
END;
$$;

GRANT EXECUTE ON FUNCTION validate_answer(UUID, TEXT, INTEGER, TEXT, BOOLEAN, INTEGER) TO anon, authenticated;

-- =============================================================================
-- RPC 4: rejoin_session
-- Single call to retrieve complete game state for rejoining
-- Replaces 5 sequential queries with 1 RPC call
-- =============================================================================
CREATE OR REPLACE FUNCTION rejoin_session(
    p_session_id UUID,
    p_username TEXT,
    p_local_id TEXT
)
RETURNS TABLE (
    "sessionId" UUID,
    "sessionCode" TEXT,
    "sessionStatus" TEXT,
    "currentQuestionIndex" INTEGER,
    "debtAmount" INTEGER,
    "qPerUser" INTEGER,
    "foundPlayerId" TEXT,
    "foundPlayerName" TEXT,
    "isManager" BOOLEAN,
    "players" JSONB,
    "questions" JSONB,
    "buzzes" JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_player RECORD;
    v_players JSONB;
    v_questions JSONB;
    v_buzzes JSONB;
BEGIN
    -- 1. Get session
    SELECT * INTO v_session FROM sessions WHERE id = p_session_id;

    IF v_session IS NULL THEN
        RETURN;
    END IF;

    -- 2. Find player - first by username, then by local_id
    SELECT * INTO v_player
    FROM players
    WHERE session_id = p_session_id
      AND (
        (p_username IS NOT NULL AND p_username != '' AND name = p_username)
        OR (p_local_id IS NOT NULL AND p_local_id != '' AND local_id = p_local_id)
      )
    ORDER BY
        CASE WHEN p_username IS NOT NULL AND p_username != '' AND name = p_username THEN 0 ELSE 1 END
    LIMIT 1;

    -- 3. Get all players with camelCase formatting
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', p.local_id,
            'name', p.name,
            'categories', COALESCE(p.categories, '[]'::jsonb),
            'score', COALESCE(p.score, 0),
            'categoryScores', COALESCE(p.category_scores, '{}'::jsonb),
            'isManager', p.is_manager
        ) ORDER BY p.joined_at ASC
    ), '[]'::jsonb) INTO v_players
    FROM players p
    WHERE p.session_id = p_session_id;

    -- 4. Get all questions
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', q.id,
            'category', q.category,
            'text', q.text,
            'answer', q.answer,
            'difficulty', q.difficulty
        ) ORDER BY q.order_index ASC
    ), '[]'::jsonb) INTO v_questions
    FROM questions q
    WHERE q.session_id = p_session_id;

    -- 5. Get buzzes with pre-calculated timeDiffMs
    WITH ordered_buzzes AS (
        SELECT
            b.player_local_id,
            EXTRACT(EPOCH FROM b.created_at)::BIGINT * 1000 AS ts,
            COALESCE(b.buzz_timestamp_ms, EXTRACT(EPOCH FROM b.created_at)::BIGINT * 1000) AS ts_ms
        FROM buzzes b
        WHERE b.session_id = p_session_id
        ORDER BY COALESCE(b.buzz_timestamp_ms, EXTRACT(EPOCH FROM b.created_at)::BIGINT * 1000) ASC
    ),
    with_first AS (
        SELECT
            ob.*,
            first_value(ob.ts_ms) OVER (ORDER BY ob.ts_ms ASC) AS first_ts_ms
        FROM ordered_buzzes ob
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'playerId', wf.player_local_id,
            'timestamp', wf.ts,
            'timestampMs', wf.ts_ms,
            'timeDiffMs', wf.ts_ms - wf.first_ts_ms
        ) ORDER BY wf.ts_ms ASC
    ), '[]'::jsonb) INTO v_buzzes
    FROM with_first wf;

    -- Return complete state
    RETURN QUERY SELECT
        v_session.id AS "sessionId",
        v_session.code AS "sessionCode",
        v_session.status AS "sessionStatus",
        COALESCE(v_session.current_question_index, 0) AS "currentQuestionIndex",
        COALESCE(v_session.debt_amount, 20) AS "debtAmount",
        COALESCE(v_session.q_per_user, 3) AS "qPerUser",
        v_player.local_id AS "foundPlayerId",
        v_player.name AS "foundPlayerName",
        COALESCE(v_player.is_manager, FALSE) AS "isManager",
        v_players AS "players",
        v_questions AS "questions",
        v_buzzes AS "buzzes";
END;
$$;

GRANT EXECUTE ON FUNCTION rejoin_session(UUID, TEXT, TEXT) TO anon, authenticated;

-- =============================================================================
-- RPC 5: get_user_dashboard
-- Replaces N+1 queries in getUserActiveSessions + getUserGameHistory
-- Single optimized query with aggregations and window functions
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_dashboard(p_user_id UUID)
RETURNS TABLE (
    "activeSessions" JSONB,
    "gameHistory" JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active_sessions JSONB;
    v_game_history JSONB;
BEGIN
    -- 1. Get active sessions (LOBBY, GENERATING, PLAYING)
    WITH user_active_sessions AS (
        SELECT DISTINCT s.id, s.code, s.status, s.created_at
        FROM sessions s
        WHERE s.user_id = p_user_id
          AND s.status IN ('LOBBY', 'GENERATING', 'PLAYING')

        UNION

        SELECT DISTINCT s.id, s.code, s.status, s.created_at
        FROM sessions s
        INNER JOIN players p ON p.session_id = s.id
        WHERE p.user_id = p_user_id
          AND s.status IN ('LOBBY', 'GENERATING', 'PLAYING')
    ),
    active_with_counts AS (
        SELECT
            uas.id,
            uas.code,
            uas.status,
            uas.created_at,
            COUNT(p.id)::INTEGER AS player_count,
            MAX(CASE WHEN p.user_id = p_user_id THEN p.score END)::INTEGER AS my_score,
            BOOL_OR(CASE WHEN p.user_id = p_user_id THEN p.is_manager ELSE FALSE END) AS is_manager
        FROM user_active_sessions uas
        LEFT JOIN players p ON p.session_id = uas.id
        GROUP BY uas.id, uas.code, uas.status, uas.created_at
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', awc.id,
            'code', awc.code,
            'status', awc.status,
            'created_at', awc.created_at,
            'player_count', awc.player_count,
            'my_score', awc.my_score,
            'is_manager', awc.is_manager
        ) ORDER BY awc.created_at DESC
    ), '[]'::jsonb) INTO v_active_sessions
    FROM active_with_counts awc;

    -- 2. Get game history (RESULTS status)
    WITH user_finished_sessions AS (
        SELECT
            s.id,
            s.code,
            s.status,
            s.created_at,
            p.score AS my_score,
            p.is_manager
        FROM sessions s
        INNER JOIN players p ON p.session_id = s.id AND p.user_id = p_user_id
        WHERE s.status = 'RESULTS'
    ),
    session_details AS (
        SELECT
            ufs.*,
            (SELECT COUNT(*)::INTEGER FROM players WHERE session_id = ufs.id) AS player_count,
            (
                SELECT name FROM players
                WHERE session_id = ufs.id
                ORDER BY score DESC LIMIT 1
            ) AS winner_name,
            (
                SELECT score FROM players
                WHERE session_id = ufs.id
                ORDER BY score DESC LIMIT 1
            ) AS winner_score,
            (
                SELECT COUNT(*)::INTEGER + 1
                FROM players other
                WHERE other.session_id = ufs.id
                  AND other.score > ufs.my_score
            ) AS my_rank
        FROM user_finished_sessions ufs
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', sd.id,
            'code', sd.code,
            'status', sd.status,
            'created_at', sd.created_at,
            'player_count', sd.player_count,
            'my_score', sd.my_score,
            'my_rank', sd.my_rank,
            'is_manager', sd.is_manager,
            'winner_name', sd.winner_name,
            'winner_score', sd.winner_score
        ) ORDER BY sd.created_at DESC
    ), '[]'::jsonb) INTO v_game_history
    FROM session_details sd;

    RETURN QUERY SELECT v_active_sessions, v_game_history;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_dashboard(UUID) TO anon, authenticated;

-- =============================================================================
-- End of Migration V3
-- =============================================================================
