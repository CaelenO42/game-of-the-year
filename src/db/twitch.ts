import { pool } from "./pool.js";

export async function getTwitchGameId(gameId: number): Promise<number | undefined> {
    const { rows } = await pool.query<{ twitch_game_id: number | null }>(`
        SELECT MIN(uid::int) AS twitch_game_id
        FROM game_external_id
        WHERE game_id = $1
        AND source = 'Twitch'
    `, [gameId]);

    return rows[0]?.twitch_game_id ?? undefined;
}