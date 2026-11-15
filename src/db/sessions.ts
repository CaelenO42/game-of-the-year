import { createHash, randomBytes } from "node:crypto";
import { pool } from "./pool.js";
import type { SessionMeta } from "../lib/sessionMeta.js";
import type { UserRow } from "./users.js";

export const SESSION_EXPIRATION_DAYS: number = 30;
export const LAST_SEEN_AT_INTERVAL_MINS: number = 5;
export const EXTEND_SESSION_AFTER_DAYS: number = 3;

export function generateToken(): string {
    return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): Buffer {
    return createHash('sha256').update(token).digest();
}

export async function createSession(userId: number, meta: SessionMeta): Promise<{ token: string, expiresAt: Date}> {
    const token = generateToken();
    const hash = hashToken(token);

    const result = await pool.query<{ expires_at: Date }>(`
        INSERT INTO user_session (user_id, token_hash, user_agent, os, client, location, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW() + make_interval(days => $7))
        RETURNING expires_at
    `, [userId, hash, meta.userAgent, meta.os, meta.client, meta.location, SESSION_EXPIRATION_DAYS]);

    return { token, expiresAt: result.rows[0]!.expires_at };
}

export async function getSessionUser(token: string): Promise<{ user: UserRow, sessionId: number, expiresAt: Date } | undefined> {
    const result = await pool.query<UserRow & { session_id: number, session_expires_at: Date }>(`
        SELECT u.*, s.id AS session_id, s.expires_at AS session_expires_at
        FROM user_session s
        JOIN app_user u ON u.id = s.user_id
        WHERE s.token_hash = $1
          AND s.expires_at > NOW()
          AND u.banned_at IS NULL
    `, [hashToken(token)]);

    const row = result.rows[0];
    if (!row) return undefined;

    const { session_id, session_expires_at, ...user} = row;
    return { user, sessionId: session_id, expiresAt: session_expires_at }
}

export async function touchSession(id: number): Promise<Date | undefined> {
    const result = await pool.query<{ expires_at: Date }>(`
        UPDATE user_session
        SET last_seen_at = NOW(),
            expires_at = CASE
                WHEN expires_at < NOW() + make_interval(days => $2::int - $4::int)
                THEN NOW() + make_interval(days => $2)
                ELSE expires_at
            END
        WHERE id = $1
        AND last_seen_at < NOW() - make_interval(mins => $3)
        RETURNING expires_at

    `, [id, SESSION_EXPIRATION_DAYS, LAST_SEEN_AT_INTERVAL_MINS, EXTEND_SESSION_AFTER_DAYS]);
    return result.rows[0]?.expires_at;
}

export async function deleteSession(token: string): Promise<number> {
    const result = await pool.query(`
        DELETE FROM user_session
        WHERE token_hash = $1
    `, [hashToken(token)]);

    return result.rowCount ?? 0;
}

export async function deleteSessionById(userId: number, sessionId: number): Promise<number> {
    const result = await pool.query(`
        DELETE FROM user_session
        WHERE id = $2 AND user_id = $1
    `, [userId, sessionId]);

    return result.rowCount ?? 0;
}

export async function deleteOtherSessions(userId: number, currentSessionId: number): Promise<number> {
    const result = await pool.query(`
        DELETE FROM user_session
        WHERE user_id = $1
        AND id != $2
    `, [userId, currentSessionId]);

    return result.rowCount ?? 0;
}

export async function deleteAllSessions(userId: number): Promise<number> {
    const result = await pool.query(`
        DELETE FROM user_session
        WHERE user_id = $1
    `, [userId]);

    return result.rowCount ?? 0;
}

export async function deleteExpiredSessions(): Promise<number> {
    const result = await pool.query(`
        DELETE FROM user_session
        WHERE expires_at < NOW()
    `);

    return result.rowCount ?? 0;
}