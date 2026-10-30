import type { IgdbGame } from "../igdb/types.js";
import { pool } from "./pool.js";

type GameRow = {
  id: number;
  igdb_id: number;
  name: string;
  summary: string | null;
  cover_image_id: string | null;
  first_release_date: Date | null;
  igdb_rating_count: number | null;
  igdb_data: IgdbGame;
};
type GenreRow = { name: string; slug: string };
type PlatformRow = { name: string; abbreviation: string | null; slug: string };

export type GameSearchResult = Pick<GameRow, "id" | "name" | "cover_image_id" | "first_release_date"> & {
  popularity: number;
};

export type GameDetail = GameRow & {
  genres: GenreRow[];
  platforms: PlatformRow[];
};

export async function saveGame(game: IgdbGame):Promise<number> {
    const client = await pool.connect();
    try {
        // Begin Query
        await client.query("BEGIN");

        // Game Table
        const { rows } = await client.query<{ id: number }>(`
            INSERT INTO game (igdb_id, name, summary, cover_image_id, first_release_date, igdb_data, igdb_rating_count, name_normalized, last_synced_at)
            VALUES ($1, $2, $3, $4, (to_timestamp($5) AT TIME ZONE 'UTC')::date, $6, $7, $8, NOW())
            ON CONFLICT (igdb_id) DO UPDATE
            SET name = EXCLUDED.name,
                name_normalized = EXCLUDED.name_normalized,
                summary = EXCLUDED.summary,
                cover_image_id = EXCLUDED.cover_image_id,
                first_release_date = EXCLUDED.first_release_date,
                igdb_data = EXCLUDED.igdb_data,
                igdb_rating_count = EXCLUDED.igdb_rating_count,
                last_synced_at = NOW()
            RETURNING id;
        `, [
            game.id,
            game.name,
            game.summary ?? null,
            game.cover?.image_id ?? null,
            game.first_release_date ?? null,
            JSON.stringify(game),
            game.total_rating_count ?? null,
            normalizeTitle(game.name),
        ]);
        const gameId = rows[0]!.id;

        // Genres
        await client.query(`DELETE FROM game_genre WHERE game_id = $1`, [gameId]);
        const genreIds = game.genres?.map(g => g.id) ?? [];

        await client.query(`
            INSERT INTO game_genre (game_id, genre_id)
            SELECT $1, id FROM genre WHERE igdb_id = ANY($2)
        `, [gameId, genreIds]);

        // Platforms
        await client.query(`DELETE FROM game_platform WHERE game_id = $1`, [gameId]);
        const platformIds = game.platforms?.map(p => p.id) ?? [];

        await client.query(`
            INSERT INTO game_platform (game_id, platform_id)
            SELECT $1, id FROM platform WHERE igdb_id = ANY($2)
        `, [gameId, platformIds]);

        // External IDs
        await client.query(`DELETE FROM game_external_id WHERE game_id = $1`, [gameId]);
        for (const ext of game.external_games ?? []) {
            if (!ext.external_game_source) continue;
            await client.query(`
                INSERT INTO game_external_id (source, uid, game_id)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            `, [ext.external_game_source.name, ext.uid, gameId]);
        }

        // Commit
        await client.query("COMMIT");
        return gameId;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export async function getGame(id: number):Promise<GameDetail | undefined> {
    const gameData = await pool.query<GameRow>(`
        SELECT id, igdb_id, name, summary, cover_image_id, first_release_date, igdb_rating_count, igdb_data
        FROM game
        WHERE id = $1
    `, [id]);

    const game = gameData.rows[0];
    if (!game) return;
    
    const [genres, platforms] = await Promise.all([
        pool.query<GenreRow>(`
            SELECT g.name, g.slug
            FROM game_genre gg
            JOIN genre g ON g.id = gg.genre_id
            WHERE gg.game_id = $1
            ORDER BY g.name
        `, [id]),
        pool.query<PlatformRow>(`
            SELECT p.name, p.abbreviation, p.slug
            FROM game_platform gp
            JOIN platform p ON p.id = gp.platform_id
            WHERE gp.game_id = $1
            ORDER BY p.name
        `, [id])
    ])

    return {...game, genres: genres.rows, platforms: platforms.rows};
}

export function sqlEscape(s: string):string | undefined {
    if (typeof s !== "string") return;
    return s.replaceAll(/([\\_%])/g, "\\$1");
}

// Stored in game.name_normalized by saveGame; the search query is normalized the same way.
export function normalizeTitle(s: string): string {
    return s.toLowerCase().replaceAll(/[^\p{L}\p{N}\s]/gu, "");
}

export type GameSearchPage = {
    results: GameSearchResult[];
    total: number;
};
type GameSearchRow = GameSearchResult & { total: string };

export async function searchGames(query: string, offset: number = 0, limit: number = 20):Promise<GameSearchPage> {
    query = query.slice(0, 99).trim();
    if (query.length === 0) return { results: [], total: 0 };
    const gameData = await pool.query<GameSearchRow>(`
        SELECT id, name, cover_image_id, first_release_date, popularity, count(*) OVER() AS total
        FROM game
        WHERE name ILIKE '%' || $1 || '%'
        OR $2 <% name
        ORDER BY
            name_normalized = $3 DESC,
            word_similarity($2, name) DESC,
            popularity DESC,
            name,
            id
        LIMIT $4
        OFFSET $5;
    `, [sqlEscape(query), query, normalizeTitle(query), limit, offset]);

    return { results: gameData.rows, total: Number(gameData.rows[0]?.total ?? 0) };
}