import type { Status } from '../validation/userGame.js';
import { pool } from './pool.js';

const USER_GAME_COLUMNS = 'user_id, game_id, status, rating, favorited_at, library_added_at, created_at, updated_at';

type ValueColumn = 'status' | 'rating';
type TimestampColumn = 'favorited_at' | 'library_added_at';
type UpdateColumn = ValueColumn | TimestampColumn;

export type UserGameRow = {
    user_id: number,
    game_id: number,
    status: Status | null,
    rating: number | null,
    favorited_at: Date | null,
    library_added_at: Date | null,
    created_at: Date,
    updated_at: Date
}

export type GameStats = {
    average: number | null,
    count: number
}

export async function getUserGame(userId: number, gameId: number): Promise<UserGameRow | undefined> {
    const gameRow = await pool.query<UserGameRow>(`
        SELECT ${USER_GAME_COLUMNS}
        FROM user_game
        WHERE user_id = $1
        AND game_id = $2
    `, [userId, gameId]);

    return gameRow.rows[0];
}

export async function getGameStats(gameId: number): Promise<GameStats> {
    const stats = await pool.query<GameStats>(`
        SELECT AVG(rating)::float AS average, COUNT(rating)::int AS count
        FROM user_game
        WHERE game_id = $1
    `, [gameId]);

    return stats.rows[0]!;
}

export async function setStatus(userId: number, gameId: number, status: Status | null): Promise<UserGameRow | undefined> {
    if (status !== null) return upsert('status', userId, gameId, status);
    return remove('status', userId, gameId);
}

export function setRating(userId: number, gameId: number, rating: number | null): Promise<UserGameRow | undefined> {
    if (rating !== null) return upsert('rating', userId, gameId, rating);
    return remove('rating', userId, gameId);
}

export function setFavorite(userId: number, gameId: number, favorited: boolean): Promise<UserGameRow | undefined> {
    if (favorited) return upsertTimestamp('favorited_at', userId, gameId);
    return remove('favorited_at', userId, gameId);
}

export function setLibrary(userId: number, gameId: number, libraryAdded: boolean): Promise<UserGameRow | undefined> {
    if (libraryAdded) return upsertTimestamp('library_added_at', userId, gameId);
    return remove('library_added_at', userId, gameId);
}

async function upsert(column: ValueColumn, userId: number, gameId: number, value: string | number): Promise<UserGameRow> {
    const userGame = await pool.query<UserGameRow>(`
        INSERT INTO user_game (user_id, game_id, ${column})
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, game_id) DO UPDATE
        SET ${column} = EXCLUDED.${column},
            updated_at = NOW()
        RETURNING ${USER_GAME_COLUMNS}
    `, [userId, gameId, value]);
    return userGame.rows[0]!;
}

async function upsertTimestamp(column: TimestampColumn, userId: number, gameId: number): Promise<UserGameRow> {
    const userGame = await pool.query<UserGameRow>(`
        INSERT INTO user_game (user_id, game_id, ${column})
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id, game_id) DO UPDATE
        SET ${column} = COALESCE(user_game.${column}, NOW())
        RETURNING ${USER_GAME_COLUMNS}
    `, [userId, gameId]);
    return userGame.rows[0]!;
}

async function remove(column: UpdateColumn, userId: number, gameId: number): Promise<UserGameRow | undefined> {
    const result = await pool.query<UserGameRow>(`
        DELETE FROM user_game
        WHERE user_id = $1 AND game_id = $2
        AND ${column} IS NOT NULL
        AND num_nonnulls(status, rating, favorited_at, library_added_at) = 1
    `, [userId, gameId]);

    if (result.rowCount === 1) return undefined;

    const userGame = await pool.query<UserGameRow>(`
        UPDATE user_game SET ${column} = NULL, updated_at = NOW()
        WHERE user_id = $1 AND game_id = $2
        RETURNING ${USER_GAME_COLUMNS}
    `, [userId, gameId]);
    return userGame.rows[0];
}
