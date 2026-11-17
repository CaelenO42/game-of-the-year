import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { pool } from "../../src/db/pool.js";
import { createSession, getSessionUser, deleteSession, deleteSessionById, deleteOtherSessions, deleteAllSessions, deleteExpiredSessions, touchSession } from "../../src/db/sessions.js";
import { createTestUser, resetDb } from "../helpers/db.js";
import { hashToken } from "../../src/lib/token.js";

const meta = { userAgent: "test", os: null, client: null, location: null };

beforeEach(resetDb);
afterAll(() => pool.end());

describe("sessions", () => {
    test("a created session can be looked up by its token", async () => {
        const user = await createTestUser();
        const { token } = await createSession(user.id, meta);

        const found = await getSessionUser(token);
        expect(found?.user.id).toBe(user.id);
    });

    test("an unknown token finds nothing", async () => {
        expect(await getSessionUser("not-a-real-token")).toBeUndefined();
    });

    test("expired session isnt found", async () => {
        const user = await createTestUser();
        const { token } = await createSession(user.id, meta);
        await pool.query(`
            UPDATE user_session 
            SET expires_at = NOW() - INTERVAL '1 day'
            WHERE token_hash = $1
        `, [hashToken(token)]);

        const sessionUser = await getSessionUser(token);
        expect(sessionUser).toBeUndefined();
    })

    test("deleteSession invalidates the token", async () => {
        const user = await createTestUser();
        const { token } = await createSession(user.id, meta);
        const count = await deleteSession(token);
        expect(count).toBe(1);

        const sessionUser = await getSessionUser(token);
        expect(sessionUser).toBeUndefined();
    });

    test("deleteSessionById is scoped to user", async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser("other-uid");

        const { token } = await createSession(user1.id, meta);
        const sessionUser = await getSessionUser(token);

        const count = await deleteSessionById(user2.id, sessionUser!.sessionId);
        expect(count).toBe(0);
    });

    test("deleteOtherSessions deletes for one user", async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser("other-uid");

        const sessionPromise1 = await createSession(user1.id, meta);
        const sessionPromise2 = await createSession(user1.id, meta);

        const sessionPromise3 = await createSession(user2.id, meta);

        const sessionUser = await getSessionUser(sessionPromise1.token);
        const count = await deleteOtherSessions(user1.id, sessionUser!.sessionId);
        expect(count).toBe(1);
    });

    test("deleteAllSessions removes all sessions", async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser("other-uid");

        const sessionPromise1 = await createSession(user1.id, meta);
        const sessionPromise2 = await createSession(user1.id, meta);

        const sessionPromise3 = await createSession(user2.id, meta);

        const sessionUser = await getSessionUser(sessionPromise1.token);
        const count = await deleteAllSessions(user1.id);
        expect(count).toBe(2);
    });

    test("deleteExpiredSessions removes old sessions", async () => {
        const user = await createTestUser();

        const sessionPromise1 = await createSession(user.id, meta);
        const sessionPromise2 = await createSession(user.id, meta);

        await pool.query(`
            UPDATE user_session 
            SET expires_at = NOW() - INTERVAL '1 day'
            WHERE token_hash = $1
        `, [hashToken(sessionPromise1.token)]);

        const count = await deleteExpiredSessions();
        expect(count).toBe(1);
    });

    test("touchSession throttles on recent updates", async () => {
        const user = await createTestUser();
        const sessionPromise = await createSession(user.id, meta);
        const sessionUser = await getSessionUser(sessionPromise.token);
        const touch = await touchSession(sessionUser!.sessionId);
        expect(touch).toBeUndefined();
    })

    test("touchSession updates last_seen_at", async () => {
        const user = await createTestUser();
        const sessionPromise = await createSession(user.id, meta);
        const sessionUser = await getSessionUser(sessionPromise.token);

        await pool.query(`
            UPDATE user_session 
            SET last_seen_at = NOW() - INTERVAL '1 day'
            WHERE id = $1
        `, [sessionUser!.sessionId]);

        const before = await pool.query("SELECT last_seen_at FROM user_session WHERE id = $1", [sessionUser!.sessionId]);
        await touchSession(sessionUser!.sessionId);
        const after = await pool.query("SELECT last_seen_at FROM user_session WHERE id = $1", [sessionUser!.sessionId]);
        expect(after.rows[0].last_seen_at.getTime()).toBeGreaterThan(before.rows[0].last_seen_at.getTime());
    });

    test("touchSession updates expiry when needed", async() => {
        const user = await createTestUser();
        const sessionPromise = await createSession(user.id, meta);
        const sessionUser = await getSessionUser(sessionPromise.token);

        await pool.query(`
            UPDATE user_session
            SET last_seen_at = NOW() - INTERVAL '1 day',
                expires_at   = NOW() + INTERVAL '10 days'
            WHERE id = $1
        `, [sessionUser!.sessionId]);

        const touch = await touchSession(sessionUser!.sessionId);
        expect(touch!.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    })
});
