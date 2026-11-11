import { pool } from "../../src/db/pool.js";
import { upsertUser } from "../../src/db/users.js";

if (!process.env.DATABASE_URL?.endsWith("_test")) {
    throw new Error("Refusing to run tests against a non-test database");
}

export async function resetDb() {
    await pool.query("TRUNCATE user_session, username_reservation, app_user RESTART IDENTITY CASCADE");
}

export function createTestUser(uid = "test-uid") {
    return upsertUser(uid);
}