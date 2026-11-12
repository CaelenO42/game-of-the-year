import { pool } from "../../src/db/pool.js";
import { upsertUser } from "../../src/db/users.js";

if (!process.env.DATABASE_URL?.endsWith("_test")) {
    throw new Error("Refusing to run tests against a non-test database");
}

export async function resetDb() {
    await pool.query("TRUNCATE user_session, username_reservation, app_user, game RESTART IDENTITY CASCADE");
}

export function createTestUser(uid = "test-uid") {
    return upsertUser(uid);
}

export async function createTestGame(igdbId = 1, name = "Test Game") {
    const r = await pool.query<{ id: number }>(
        "INSERT INTO game (igdb_id, name) VALUES ($1, $2) RETURNING id", [igdbId, name]);
    return r.rows[0]!;
}