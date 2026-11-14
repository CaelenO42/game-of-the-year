import type { Role } from "../roles.js";
import { validateUsername } from "../username.js";
import { pool, withTransaction } from "./pool.js";
import { deleteAllSessions } from "./sessions.js";

export type UserRow = {
    id: number,
    firebase_uid: string,
    username: string | null,
    display_name: string | null,
    profile_picture: string | null,
    role: Role,
    username_changed_at: Date | null,
    created_at: Date,
    banned_at: Date | null
}

type UsernameResponse =
    | { ok: true, user: UserRow }
    | { ok: false, reason: "taken" | "no_user" | "reserved" | "invalid" }
    | { ok: false, reason: "cooldown", availableAt: Date };

type AdminActionResponse = 
    | { ok: true, user: UserRow }
    | { ok: false, reason: 'not_admin' | 'no_user' | 'self' | 'target_is_admin' }

const USERNAME_COLUMNS = "id, firebase_uid, username, display_name, profile_picture, role, username_changed_at, created_at, banned_at";
const USERNAME_COOLDOWN_DAYS = 30;
const USERNAME_RESERVED_DAYS = 37;

export async function getUser(id: number): Promise<UserRow | undefined> {
    const userData = await pool.query<UserRow>(`
            SELECT ${USERNAME_COLUMNS}
            FROM app_user
            WHERE id = $1
        `, [id]);

    return userData.rows[0];
}

export async function getUserByFirebaseUid(firebaseUid: string): Promise<UserRow | undefined> {
    const userData = await pool.query<UserRow>(`
            SELECT ${USERNAME_COLUMNS}
            FROM app_user
            WHERE firebase_uid = $1
        `, [firebaseUid]);

    return userData.rows[0];
}

export async function setUsername(id: number, raw: string): Promise<UsernameResponse> {
    const result = validateUsername(raw);
    if (!result.ok) return { ok: false, reason: 'invalid' };

    try {
        return await withTransaction(async (client): Promise<UsernameResponse> => {
            // Get current user info
            const current = await client.query<UserRow & { available_at: Date | null, in_cooldown: boolean | null }>(`
                SELECT ${USERNAME_COLUMNS},
                    username_changed_at + make_interval(days => $2) AS available_at,
                    username_changed_at + make_interval(days => $2) > NOW() AS in_cooldown
                FROM app_user
                WHERE id = $1
                FOR UPDATE
            `, [id, USERNAME_COOLDOWN_DAYS]);
            const row = current.rows[0];

            if (!row) return { ok: false, reason: 'no_user' }; // Return if no user
            if (row.username === result.username) return { ok: true, user: row }; // Return if new username match old username

            // Check if user is in cooldown period
            if (row.username && row.in_cooldown && row.available_at) return { ok: false, reason: 'cooldown', availableAt: row.available_at };

            // Check reservation table
            const reserved = await client.query<{ user_id: number }>(`
                    SELECT user_id
                    FROM username_reservation
                    WHERE username = $1
                    AND expires_at > NOW()
                `, [result.username]);

            if (reserved.rows[0] && reserved.rows[0].user_id !== id) return { ok: false, reason: 'reserved' };

            // Change username
            const isChange = row.username !== null;
            const userData = await client.query<UserRow>(`
                    UPDATE app_user
                    SET username = $2,
                        username_changed_at = CASE WHEN $3 THEN NOW() ELSE username_changed_at END
                    WHERE id = $1
                    RETURNING ${USERNAME_COLUMNS}
                `, [id, result.username, isChange]);
            
            // Reserve old name if changed
            if (isChange) {
                await client.query(`
                        INSERT INTO username_reservation (username, user_id, expires_at)
                        VALUES ($1, $2, NOW() + make_interval(days => $3))
                        ON CONFLICT (username) DO UPDATE
                        SET user_id = EXCLUDED.user_id,
                            expires_at = EXCLUDED.expires_at
                    `, [row.username, id, USERNAME_RESERVED_DAYS]);
            }

            // Clear hold on new name
            await client.query(`
                    DELETE FROM username_reservation
                    WHERE username = $2 AND user_id = $1
                `, [id, result.username]);

            return { ok: true, user: userData.rows[0]! };
        });
    } catch (err) {
        if ((err as { code?: string }).code === "23505") return { ok: false, reason: 'taken' };
        throw err;
    }
}

export async function getUserByUsername(username: string): Promise<UserRow | undefined> {
    const userData = await pool.query<UserRow>(`
        SELECT ${USERNAME_COLUMNS}
        FROM app_user
        WHERE username = $1
    `, [username.toLowerCase()]);

    return userData.rows[0];
}

export async function upsertUser(firebaseUid: string): Promise<UserRow> {
    const userData = await pool.query<UserRow>(`
            INSERT INTO app_user (firebase_uid)
            VALUES ($1)
            ON CONFLICT (firebase_uid) DO UPDATE
            SET firebase_uid = EXCLUDED.firebase_uid
            RETURNING ${USERNAME_COLUMNS}
        `, [firebaseUid]);

    return userData.rows[0]!;
}

export async function setRole(adminId: number, userId: number, role: Role): Promise<AdminActionResponse> {
    if (adminId === userId) return { ok: false, reason: 'self' };
    const admin = await getUser(adminId);
    if (admin?.role !== 'admin') return { ok: false, reason: 'not_admin' };

    const userData = await pool.query<UserRow>(`
        UPDATE app_user
        SET role = $2
        WHERE id = $1
        RETURNING ${USERNAME_COLUMNS}
    `, [userId, role]);

    if (!userData.rows[0]) return { ok: false, reason: 'no_user' };
    return { ok: true, user: userData.rows[0] };
}

export async function setBanned(adminId: number, userId: number, banned: boolean): Promise<AdminActionResponse> {
    if (adminId === userId) return { ok: false, reason: 'self' };
    const admin = await getUser(adminId);
    if (admin?.role !== 'admin') return { ok: false, reason: 'not_admin' };

    const userData = await pool.query<UserRow>(`
        UPDATE app_user
        SET banned_at = CASE WHEN $2 THEN COALESCE(banned_at, NOW()) ELSE NULL END
        WHERE id = $1
            AND (NOT $2 OR role <> 'admin')
        RETURNING ${USERNAME_COLUMNS}
    `, [userId, banned]);

    if (!userData.rows[0]) {
        const actionUser = await getUser(userId);
        if (!actionUser) return { ok: false, reason: 'no_user' };
        return { ok: false, reason: 'target_is_admin' };
    }
    if (banned) await deleteAllSessions(userId);
    return { ok: true, user: userData.rows[0] };
}

export async function listUsers(pageSize: number = 20, page: number = 1): Promise<{ users: UserRow[], total: number}> {
    const offset = (page - 1) * pageSize;
    const [ users, total ] = await Promise.all([
        pool.query<UserRow>(`
            SELECT ${USERNAME_COLUMNS}
            FROM app_user
            ORDER BY created_at DESC, id DESC
            LIMIT $1 OFFSET $2
        `, [pageSize, offset]),
        pool.query<{ total: number }>(`
            SELECT COUNT(*)::int AS total FROM app_user
        `)
    ]);

    return { users: users.rows, total: total.rows[0]!.total };
}