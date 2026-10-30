CREATE EXTENSION IF NOT EXISTS pg_trgm; 

CREATE TABLE IF NOT EXISTS game (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    igdb_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    summary TEXT,
    cover_image_id TEXT,
    first_release_date DATE,
    igdb_data JSONB,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    igdb_rating_count INTEGER,
    popularity DOUBLE PRECISION GENERATED ALWAYS AS (ln(1 + coalesce(igdb_rating_count, 0))) STORED
);
-- Lowercased title without punctuation, for exact-match ranking. Set by saveGame() via normalizeTitle() in src/db/games.ts.
ALTER TABLE game ADD COLUMN IF NOT EXISTS name_normalized TEXT;
CREATE INDEX IF NOT EXISTS game_popularity_idx ON game (popularity DESC);
CREATE INDEX IF NOT EXISTS game_name_trgm_idx ON game USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS platform (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    igdb_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    abbreviation TEXT,
    summary TEXT,
    slug TEXT NOT NULL UNIQUE,
    logo_image_id TEXT,
    platform_type TEXT
);

CREATE TABLE IF NOT EXISTS genre (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    igdb_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS game_platform (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    platform_id INTEGER NOT NULL REFERENCES platform(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, platform_id)
);
CREATE INDEX IF NOT EXISTS game_platform_platform_id_idx ON game_platform (platform_id);

CREATE TABLE IF NOT EXISTS game_genre (
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genre(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, genre_id)
);
CREATE INDEX IF NOT EXISTS game_genre_genre_id_idx ON game_genre (genre_id);

CREATE TABLE IF NOT EXISTS game_external_id (
    source TEXT NOT NULL,
    uid TEXT NOT NULL,
    game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    PRIMARY KEY (source, uid)
);
CREATE INDEX IF NOT EXISTS game_external_id_game_id_idx ON game_external_id (game_id);