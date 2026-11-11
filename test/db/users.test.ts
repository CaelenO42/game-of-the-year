import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { pool } from "../../src/db/pool.js";
import { getUserByFirebaseUid, getUserByUsername, setUsername, upsertUser } from "../../src/db/users.js";
import { createTestUser, resetDb } from "../helpers/db.js";

const DAY_MS = 86_400_000;

beforeEach(resetDb);
afterAll(() => pool.end());

async function mustSet(userId: number, name: string) {
    const result = await setUsername(userId, name);
    if (!result.ok) throw new Error(`expected setUsername("${name}") to succeed, got "${result.reason}"`);
    return result.user;
}

async function reservationsFor(userId: number) {
    const { rows } = await pool.query<{ username: string, expires_at: Date }>(
        "SELECT username, expires_at FROM username_reservation WHERE user_id = $1 ORDER BY username",
        [userId],
    );
    return rows;
}

async function userRow(userId: number) {
    const { rows } = await pool.query<{ username: string | null, username_changed_at: Date | null }>(
        "SELECT username, username_changed_at FROM app_user WHERE id = $1",
        [userId],
    );
    return rows[0]!;
}

async function backdateChange(userId: number, days: number) {
    await pool.query(
        "UPDATE app_user SET username_changed_at = NOW() - make_interval(days => $2::int) WHERE id = $1",
        [userId, days],
    );
}

// setUsername
describe("setUsername", () => {
    test("first set stores the name lowercase and does not start the cooldown", async () => {
        const user = await createTestUser();

        const updated = await mustSet(user.id, "Caelen");

        expect(updated.username).toBe("caelen");
        expect((await userRow(user.id)).username_changed_at).toBeNull();
        expect(await reservationsFor(user.id)).toHaveLength(0);
    });

    test.each(["ab", "bad name", "admin", "-bob"])("rejects invalid name %j", async (name) => {
        const user = await createTestUser();

        expect(await setUsername(user.id, name)).toMatchObject({ ok: false, reason: "invalid" });
        expect((await userRow(user.id)).username).toBeNull();
    });

    test("a name another user has is taken, in any casing", async () => {
        const a = await createTestUser("uid-a");
        const b = await createTestUser("uid-b");
        await mustSet(a.id, "caelen");

        expect(await setUsername(b.id, "caelen")).toMatchObject({ ok: false, reason: "taken" });
        expect(await setUsername(b.id, "CAELEN")).toMatchObject({ ok: false, reason: "taken" });
    });

    test("setting your current name again is a no-op", async () => {
        const user = await createTestUser();
        await mustSet(user.id, "caelen");

        const again = await setUsername(user.id, "Caelen");

        expect(again).toMatchObject({ ok: true });
        expect((await userRow(user.id)).username_changed_at).toBeNull();
        expect(await reservationsFor(user.id)).toHaveLength(0);
    });

    test("changing a name starts the cooldown and reserves the old name", async () => {
        const user = await createTestUser();
        await mustSet(user.id, "caelen");

        const updated = await mustSet(user.id, "cael1");

        expect(updated.username).toBe("cael1");
        expect((await userRow(user.id)).username_changed_at).not.toBeNull();

        const held = await reservationsFor(user.id);
        expect(held).toHaveLength(1);
        expect(held[0]!.username).toBe("caelen");
        // reserved for about 37 days
        expect(held[0]!.expires_at.getTime()).toBeGreaterThan(Date.now() + 36 * DAY_MS);
        expect(held[0]!.expires_at.getTime()).toBeLessThan(Date.now() + 38 * DAY_MS);
    });

    test("a second change during the cooldown is refused with the date it ends", async () => {
        const user = await createTestUser();
        await mustSet(user.id, "caelen");
        await mustSet(user.id, "cael1");

        const result = await setUsername(user.id, "cael2");

        expect(result).toMatchObject({ ok: false, reason: "cooldown" });
        if (result.ok || result.reason !== "cooldown") throw new Error("unreachable");
        expect(result.availableAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY_MS);
        expect(result.availableAt.getTime()).toBeLessThan(Date.now() + 31 * DAY_MS);
        expect((await userRow(user.id)).username).toBe("cael1");
    });

    test("changing is allowed again once the cooldown has passed", async () => {
        const user = await createTestUser();
        await mustSet(user.id, "caelen");
        await mustSet(user.id, "cael1");
        await backdateChange(user.id, 31);

        const updated = await mustSet(user.id, "cael2");

        expect(updated.username).toBe("cael2");
    });

    test("an old name is reserved: other users cannot take it", async () => {
        const a = await createTestUser("uid-a");
        const b = await createTestUser("uid-b");
        await mustSet(a.id, "caelen");
        await mustSet(a.id, "cael1");

        expect(await setUsername(b.id, "caelen")).toMatchObject({ ok: false, reason: "reserved" });
    });

    test("the original owner can reclaim a reserved name, which clears the hold", async () => {
        const a = await createTestUser();
        await mustSet(a.id, "caelen");
        await mustSet(a.id, "cael1");
        await backdateChange(a.id, 31);

        const updated = await mustSet(a.id, "caelen");

        expect(updated.username).toBe("caelen");
        const held = (await reservationsFor(a.id)).map((r) => r.username);
        expect(held).not.toContain("caelen");
        expect(held).toContain("cael1"); // the name just released is now the reserved one
    });

    test("an expired reservation no longer blocks other users", async () => {
        const a = await createTestUser("uid-a");
        const b = await createTestUser("uid-b");
        await mustSet(a.id, "caelen");
        await mustSet(a.id, "cael1");
        await pool.query("UPDATE username_reservation SET expires_at = NOW() - INTERVAL '1 day' WHERE username = 'caelen'");

        const updated = await mustSet(b.id, "caelen");

        expect(updated.username).toBe("caelen");
    });

    test("a refused change leaves everything as it was", async () => {
        const a = await createTestUser("uid-a");
        const b = await createTestUser("uid-b");
        await mustSet(a.id, "alpha1");
        await mustSet(b.id, "taken1");

        const result = await setUsername(a.id, "taken1");

        expect(result).toMatchObject({ ok: false, reason: "taken" });
        const row = await userRow(a.id);
        expect(row.username).toBe("alpha1");
        expect(row.username_changed_at).toBeNull();
        expect(await reservationsFor(a.id)).toHaveLength(0);
    });

    test("an unknown user id reports no_user", async () => {
        expect(await setUsername(999_999, "someone")).toMatchObject({ ok: false, reason: "no_user" });
    });
});

// lookups

describe("user lookups", () => {
    test("upsertUser is idempotent for the same firebase uid", async () => {
        const first = await upsertUser("uid-a");
        const second = await upsertUser("uid-a");

        expect(second.id).toBe(first.id);
    });

    test("getUserByFirebaseUid finds a user, and nothing for an unknown uid", async () => {
        const user = await createTestUser("uid-a");

        expect((await getUserByFirebaseUid("uid-a"))?.id).toBe(user.id);
        expect(await getUserByFirebaseUid("nope")).toBeUndefined();
    });

    test("getUserByUsername is case-insensitive", async () => {
        const user = await createTestUser();
        await mustSet(user.id, "caelen");

        expect((await getUserByUsername("CAELEN"))?.id).toBe(user.id);
        expect(await getUserByUsername("nobody")).toBeUndefined();
    });
});
