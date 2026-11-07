import { pool } from "./pool.js";

export type UserRow = {
    id: number,
    firebase_uid: string,
    username: string | null,
    profile_picture: string | null,
    created_at: Date
}

type UsernameResponse =
    | { ok: true, user: UserRow }
    | { ok: false, reason: "taken" | "no_user" };

const USERNAME_COLUMNS = "id, firebase_uid, username, profile_picture, created_at";

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

export async function setUsername(id: number, username: string): Promise<UsernameResponse> {
    try {
        const userData = await pool.query<UserRow>(`
                UPDATE app_user
                SET username = $2
                WHERE id = $1
                RETURNING ${USERNAME_COLUMNS}
            `, [id, username]);
        
        if (userData.rows[0]) return { ok: true, user: userData.rows[0] };
        return { ok: false, reason: 'no_user'};
    } catch (err) {
        const code = (err as {code?:string}).code;
        if (code === "23505") return { ok: false, reason: 'taken'};
        throw err;
    }
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