import { pool } from "./pool.js";
import { generateToken, hashToken } from "../lib/token.js";
import type { UserRow } from "./users.js";

const API_KEY_PREFIX = 'goty_';
const API_KEY_COLUMNS = 'id, user_id, name, key_prefix, created_at, last_used_at';

const API_KEY_INTERVAL_MINS = 5;

type CreateKeyReturn = {
    id: number,
    key: string, 
    name: string, 
    key_prefix: string, 
    created_at: Date
}

type ApiKeyRow = {
    id: number,
    user_id: number, 
    name: string,
    key_prefix: string,
    created_at: Date,
    last_used_at: Date | null
}

export async function createApiKey(userId: number, name: string): Promise<CreateKeyReturn> {
    const key = API_KEY_PREFIX + generateToken();
    const hash = hashToken(key);
    const key_prefix = key.slice(0, 11);

    const result = await pool.query<{ id: number, created_at: Date }>(`
        INSERT INTO api_key (user_id, name, key_prefix, key_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
    `, [userId, name, key_prefix, hash]);

    const row = result.rows[0]!;

    return { id: row.id, name, key, key_prefix, created_at: row.created_at };
}

export async function listApiKeys(userId: number): Promise<ApiKeyRow[]> {
    const apiKeys = await pool.query<ApiKeyRow>(`
        SELECT ${API_KEY_COLUMNS}
        FROM api_key
        WHERE user_id = $1
        ORDER BY id DESC
    `, [userId]);

    return apiKeys.rows;
}

export async function deleteApiKeyById(userId: number, keyId: number) {
    const result = await pool.query(`
        DELETE FROM api_key
        WHERE id = $2 AND user_id = $1
    `, [userId, keyId]);

    return result.rowCount ?? 0;
}

export async function getApiKeyUser(rawKey: string): Promise<{ user: UserRow, keyId: number } | undefined> {
    const result = await pool.query<UserRow & { key_id: number }>(`
        SELECT u.*, k.id AS key_id
        FROM api_key k
        JOIN app_user u ON u.id = k.user_id
        WHERE k.key_hash = $1
          AND u.banned_at IS NULL
    `, [hashToken(rawKey)]);

    const row = result.rows[0];
    if (!row) return undefined;

    const { key_id , ...user} = row;
    return { user, keyId: key_id }
}

export async function touchApiKey(id: number): Promise<void> {
    await pool.query(`
        UPDATE api_key
        SET last_used_at = NOW()
        WHERE id = $1
          AND (last_used_at IS NULL OR last_used_at < NOW() - make_interval(mins => $2))
    `, [id, API_KEY_INTERVAL_MINS]);
}