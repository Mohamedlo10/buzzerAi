-- =============================================================================
-- MIGRATION V2: Authentification, Persistance Sessions, et Buzzer Ameliore
-- =============================================================================
-- Executer cette migration APRES migration.sql dans la console SQL de Supabase

-- Extension pour generation UUID (deja activee normalement)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 0. NETTOYAGE DES DOUBLONS EXISTANTS
-- =============================================================================

-- Supprimer les doublons dans players (garder le plus recent)
DELETE FROM players p1
USING players p2
WHERE p1.session_id = p2.session_id
  AND p1.local_id = p2.local_id
  AND p1.joined_at < p2.joined_at;

-- Supprimer les doublons dans buzzes (garder le plus ancien = premier buzz)
DELETE FROM buzzes b1
USING buzzes b2
WHERE b1.session_id = b2.session_id
  AND b1.player_local_id = b2.player_local_id
  AND b1.created_at > b2.created_at;

-- =============================================================================
-- 1. TABLE USERS - Authentification utilisateurs
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide par username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- =============================================================================
-- 2. MODIFICATION TABLE SESSIONS - Lien avec utilisateur proprietaire
-- =============================================================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index pour lister les sessions d'un utilisateur
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- =============================================================================
-- 3. MODIFICATION TABLE PLAYERS - Lien optionnel avec compte utilisateur
-- =============================================================================
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Contrainte unique: un seul joueur par local_id par session (evite doublons)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_player_per_session'
    ) THEN
        ALTER TABLE players ADD CONSTRAINT unique_player_per_session
            UNIQUE (session_id, local_id);
    END IF;
END $$;

-- Index pour recherche par user_id
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_session_name ON players(session_id, name);

-- =============================================================================
-- 4. MODIFICATION TABLE BUZZES - Timing haute precision + anti-duplicata
-- =============================================================================
-- Colonne pour timestamp en millisecondes (precision maximale)
ALTER TABLE buzzes ADD COLUMN IF NOT EXISTS buzz_timestamp_ms BIGINT;

-- Contrainte unique: un seul buzz par joueur par session (evite race conditions)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_buzz_per_session'
    ) THEN
        ALTER TABLE buzzes ADD CONSTRAINT unique_buzz_per_session
            UNIQUE (session_id, player_local_id);
    END IF;
END $$;

-- Index pour tri rapide des buzzes par timing
CREATE INDEX IF NOT EXISTS idx_buzzes_session_timestamp ON buzzes(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_buzzes_session_ms ON buzzes(session_id, buzz_timestamp_ms);

-- =============================================================================
-- 5. ACTIVER REALTIME POUR TABLE USERS
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'users'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE users;
    END IF;
END $$;

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS) - Securite de base
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Politique: tout le monde peut lire les users (pour verifier existence username)
DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
CREATE POLICY "Users are viewable by everyone" ON users
    FOR SELECT USING (true);

-- Politique: tout le monde peut s'inscrire
DROP POLICY IF EXISTS "Anyone can signup" ON users;
CREATE POLICY "Anyone can signup" ON users
    FOR INSERT WITH CHECK (true);

-- Politique: un user peut modifier son propre compte
DROP POLICY IF EXISTS "Users can update own record" ON users;
CREATE POLICY "Users can update own record" ON users
    FOR UPDATE USING (true);

-- =============================================================================
-- 7. FONCTION UTILITAIRE - Mise a jour timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour auto-update de updated_at sur users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FIN MIGRATION V2
-- =============================================================================
-- Pour verifier que tout est OK:
-- SELECT * FROM users LIMIT 1;
-- SELECT * FROM pg_constraint WHERE conname LIKE '%unique%';
