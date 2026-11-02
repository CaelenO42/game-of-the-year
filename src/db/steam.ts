import type { SteamAppDetails, SteamUserReviewsSummary } from "../steam/types.js";
import { pool } from "./pool.js";

export type SteamRow = {
    steam_app_id: number;
    data: SteamAppDetails | null;
    metacritic_score: number | null;
    fetched_at: Date | null;
    steam_reviews_positive: number | null;
    steam_reviews_total: number | null;
    reviews_fetched_at: Date | null;
};

export async function getSteamRow(gameId: number): Promise<SteamRow | undefined> {
    const steamData = await pool.query<SteamRow>(`
        SELECT steam_app_id, data, metacritic_score, fetched_at,
               steam_reviews_positive, steam_reviews_total, reviews_fetched_at
        FROM game_steam
        WHERE game_id = $1
    `, [gameId]);

    return steamData.rows[0];
}

export async function getSteamAppId(gameId: number): Promise<number | undefined> {
    const { rows } = await pool.query<{ steam_app_id: number | null }>(`
        SELECT MIN(uid::int) AS steam_app_id
        FROM game_external_id
        WHERE game_id = $1
        AND source = 'Steam'
    `, [gameId]);

    return rows[0]?.steam_app_id ?? undefined;
}

export async function saveSteamDetails(gameId: number, steamAppId: number, details: SteamAppDetails | null): Promise<void> {
    await pool.query(`
        INSERT INTO game_steam (game_id, steam_app_id, data, metacritic_score, fetched_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (game_id) DO UPDATE
        SET steam_app_id = EXCLUDED.steam_app_id,
            data = EXCLUDED.data,
            metacritic_score = EXCLUDED.metacritic_score,
            fetched_at = NOW()
    `, [
        gameId,
        steamAppId,
        details ? JSON.stringify(details) : null,
        details?.metacritic?.score ?? null,
    ]);
}

export async function saveSteamReviews(gameId: number, steamAppId: number, summary: SteamUserReviewsSummary): Promise<void> {
    await pool.query(`
        INSERT INTO game_steam (game_id, steam_app_id, steam_reviews_positive, steam_reviews_total, reviews_fetched_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (game_id) DO UPDATE
        SET steam_reviews_positive = EXCLUDED.steam_reviews_positive,
            steam_reviews_total = EXCLUDED.steam_reviews_total,
            reviews_fetched_at = NOW()
    `, [
        gameId,
        steamAppId,
        summary.total_positive,
        summary.total_reviews,
    ]);
}
