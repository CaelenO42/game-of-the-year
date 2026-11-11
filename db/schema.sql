CREATE EXTENSION IF NOT EXISTS pg_trgm; 

-- ┌───────────────────────┐
-- │      Game Tables      │
-- └───────────────────────┘
CREATE TABLE IF NOT EXISTS game (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    igdb_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_normalized TEXT,
    summary TEXT,
    cover_image_id TEXT,
    first_release_date DATE,
    igdb_data JSONB,
    igdb_rating_count INTEGER,
    igdb_aggregated_rating DOUBLE PRECISION,
    igdb_aggregated_rating_count INTEGER,
    popularity DOUBLE PRECISION GENERATED ALWAYS AS (ln(1 + coalesce(igdb_rating_count, 0))) STORED,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_popularity_idx ON game (popularity DESC);
CREATE INDEX IF NOT EXISTS game_name_trgm_idx ON game USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS game_steam (
    game_id INTEGER PRIMARY KEY REFERENCES game(id) ON DELETE CASCADE,
    steam_app_id INTEGER NOT NULL,
    data JSONB,
    metacritic_score INTEGER,
    fetched_at TIMESTAMPTZ,
    steam_reviews_positive INTEGER,
    steam_reviews_total INTEGER,
    reviews_fetched_at TIMESTAMPTZ
);

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

-- ┌───────────────────────┐
-- │      User Tables      │
-- └───────────────────────┘
CREATE TABLE IF NOT EXISTS app_user (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    firebase_uid TEXT NOT NULL UNIQUE,
    username TEXT UNIQUE CONSTRAINT app_user_username_lowercase CHECK (username = lower(username)),
    display_name TEXT,
    profile_picture TEXT,
    username_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS username_reservation (
    username TEXT PRIMARY KEY CHECK (username = lower(username)),
    user_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS username_reservation_user_id_idx ON username_reservation (user_id);

CREATE TABLE IF NOT EXISTS user_session (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    token_hash BYTEA NOT NULL UNIQUE,

    -- Device info
    user_agent TEXT CHECK (char_length(user_agent) <= 512),
    os TEXT,
    client TEXT,
    location TEXT,

    -- Lifetime
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS user_session_user_id_idx ON user_session (user_id);
CREATE INDEX IF NOT EXISTS user_session_expires_at_idx ON user_session (expires_at);