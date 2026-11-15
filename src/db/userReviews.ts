import { pool } from "./pool.js"

const USER_REVIEW_COLUMNS = 'id, user_id, game_id, body, contains_spoilers, created_at, updated_at';

export type UserReviewRow = {
    id: number,
    user_id: number,
    game_id: number,
    body: string,
    contains_spoilers: boolean,
    created_at: Date,
    updated_at: Date
}

export type UserReviewDetail = UserReviewRow & {
    username: string | null,
    display_name: string | null,
    rating: number | null
}

export async function setReview(userId: number, gameId: number, text: string, spoilers: boolean): Promise<UserReviewRow> {
    const reviewRow = await pool.query<UserReviewRow>(`
        INSERT INTO user_review (user_id, game_id, body, contains_spoilers)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, game_id) DO UPDATE
        SET body = EXCLUDED.body,
            contains_spoilers = EXCLUDED.contains_spoilers,
            updated_at = NOW()
        RETURNING ${USER_REVIEW_COLUMNS}
    `, [userId, gameId, text, spoilers]);
    return reviewRow.rows[0]!;
}

export async function getUserReview(userId: number, gameId: number): Promise<UserReviewRow | undefined> {
    const reviewRow = await pool.query<UserReviewRow>(`
        SELECT ${USER_REVIEW_COLUMNS}
        FROM user_review
        WHERE user_id = $1
          AND game_id = $2
    `, [userId, gameId]);

    return reviewRow.rows[0];
}

export async function getReview(userId: number, gameId: number): Promise<UserReviewDetail | undefined> {
    const reviewRow = await pool.query<UserReviewDetail>(`
        SELECT r.id, r.user_id, r.game_id, r.body, r.contains_spoilers, r.created_at, r.updated_at,
            u.username, u.display_name,
            ug.rating
        FROM user_review r
        JOIN app_user u ON u.id = r.user_id
        LEFT JOIN user_game ug ON ug.user_id = r.user_id AND ug.game_id = r.game_id
        WHERE r.user_id = $1 AND r.game_id = $2
    `, [userId, gameId]);

    return reviewRow.rows[0];
}

export async function listReviewsForGame(gameId: number, pageSize: number = 10, page: number = 1): Promise<{ reviews: UserReviewDetail[], total: number }> {
    const offset = (page - 1) * pageSize;
    const [reviews, total ] = await Promise.all([
        pool.query<UserReviewDetail>(`
            SELECT r.id, r.user_id, r.game_id, r.body, r.contains_spoilers, r.created_at, r.updated_at,
                u.username, u.display_name,
                ug.rating
            FROM user_review r
            JOIN app_user u ON u.id = r.user_id
            LEFT JOIN user_game ug ON ug.user_id = r.user_id AND ug.game_id = r.game_id
            WHERE r.game_id = $1
            ORDER BY r.created_at DESC, r.id DESC
            LIMIT $2 OFFSET $3
        `, [gameId, pageSize, offset]),
        pool.query<{ total: number }>(`
            SELECT COUNT(*)::int AS total FROM user_review
            WHERE game_id = $1
        `, [gameId])
    ]);

    return { reviews: reviews.rows, total: total.rows[0]!.total }
}

export async function deleteReview(userId: number, gameId: number): Promise<number> {
    const result = await pool.query(`
        DELETE FROM user_review
        WHERE user_id = $1 AND game_id = $2
    `, [userId, gameId]);

    return result.rowCount ?? 0;
}