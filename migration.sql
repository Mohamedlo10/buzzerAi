
-- Activation des extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table des Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'LOBBY', -- LOBBY, GENERATING, PLAYING, RESULTS
    debt_amount INTEGER DEFAULT 20,
    q_per_user INTEGER DEFAULT 3,
    current_question_index INTEGER DEFAULT -1,
    manager_id TEXT, -- ID local du gérant
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des Joueurs
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT NOT NULL, -- ID généré côté client
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    categories JSONB DEFAULT '[]'::jsonb,
    score INTEGER DEFAULT 0,
    category_scores JSONB DEFAULT '{}'::jsonb,
    is_manager BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table des Questions
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    category TEXT,
    text TEXT,
    answer TEXT,
    difficulty TEXT,
    order_index INTEGER,
    winner_id TEXT -- Local ID du gagnant
);

-- 4. Table des Buzz (File d'attente)
CREATE TABLE buzzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    player_local_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
ALTER PUBLICATION supabase_realtime ADD TABLE buzzes;
