import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { pool } from "../../src/db/pool.js";
import { getUser, listUsers, setBanned, setRole } from "../../src/db/users.js";
import { createSession, getSessionUser } from "../../src/db/sessions.js";
import { createTestAdmin, createTestUser, resetDb } from "../helpers/db.js";

const meta = { userAgent: "test", os: null, client: null, location: null };

beforeEach(resetDb);
afterAll(() => pool.end());

async function sessionCount(userId: number) {
    const r = await pool.query("SELECT COUNT(*)::int AS n FROM user_session WHERE user_id = $1", [userId]);
    return r.rows[0].n as number;
}

describe("setRole", () => {
    test("an admin can promote a user", async () => {
        const admin = await createTestAdmin();
        const user = await createTestUser();

        const result = await setRole(admin.id, user.id, "admin");

        expect(result).toMatchObject({ ok: true, user: { id: user.id, role: "admin" } });
        expect((await getUser(user.id))?.role).toBe("admin");
    });

    test("an admin can demote another admin", async () => {
        const admin = await createTestAdmin("admin-1");
        const other = await createTestAdmin("admin-2");

        const result = await setRole(admin.id, other.id, "user");

        expect(result).toMatchObject({ ok: true, user: { role: "user" } });
    });

    test("a non-admin cannot change roles, and nothing changes", async () => {
        const user = await createTestUser("user-1");
        const target = await createTestUser("user-2");

        const result = await setRole(user.id, target.id, "admin");

        expect(result).toEqual({ ok: false, reason: "not_admin" });
        expect((await getUser(target.id))?.role).toBe("user");
    });

    test("an admin cannot change their own role", async () => {
        const admin = await createTestAdmin();

        const result = await setRole(admin.id, admin.id, "user");

        expect(result).toEqual({ ok: false, reason: "self" });
        expect((await getUser(admin.id))?.role).toBe("admin");
    });

    test("a missing target reports no_user", async () => {
        const admin = await createTestAdmin();

        expect(await setRole(admin.id, 999999, "admin")).toEqual({ ok: false, reason: "no_user" });
    });

    test("a missing caller is not an admin", async () => {
        const target = await createTestUser();

        expect(await setRole(999999, target.id, "admin")).toEqual({ ok: false, reason: "not_admin" });
    });
});

describe("setBanned", () => {
    test("banning sets banned_at", async () => {
        const admin = await createTestAdmin();
        const user = await createTestUser();

        const result = await setBanned(admin.id, user.id, true);

        expect(result.ok).toBe(true);
        expect((await getUser(user.id))?.banned_at).toBeInstanceOf(Date);
    });

    test("banning twice keeps the original timestamp", async () => {
        const admin = await createTestAdmin();
        const user = await createTestUser();
        await setBanned(admin.id, user.id, true);
        await pool.query("UPDATE app_user SET banned_at = NOW() - INTERVAL '1 day' WHERE id = $1", [user.id]);
        const original = (await getUser(user.id))!.banned_at!;

        await setBanned(admin.id, user.id, true);

        expect((await getUser(user.id))!.banned_at!.getTime()).toBe(original.getTime());
    });

    test("unbanning clears banned_at", async () => {
        const admin = await createTestAdmin();
        const user = await createTestUser();
        await setBanned(admin.id, user.id, true);

        const result = await setBanned(admin.id, user.id, false);

        expect(result).toMatchObject({ ok: true, user: { banned_at: null } });
        expect((await getUser(user.id))?.banned_at).toBeNull();
    });

    test("banning removes all of the user's sessions", async () => {
        const admin = await createTestAdmin();
        const user = await createTestUser();
        const { token } = await createSession(user.id, meta);
        await createSession(user.id, meta);

        await setBanned(admin.id, user.id, true);

        expect(await sessionCount(user.id)).toBe(0);
        expect(await getSessionUser(token)).toBeUndefined();
    });

    test("banning one user does not touch another user's sessions", async () => {
        const admin = await createTestAdmin();
        const user = await createTestUser("user-1");
        const bystander = await createTestUser("user-2");
        await createSession(bystander.id, meta);

        await setBanned(admin.id, user.id, true);

        expect(await sessionCount(bystander.id)).toBe(1);
    });

    test("unbanning does not remove sessions", async () => {
        const admin = await createTestAdmin();
        const user = await createTestUser();
        await createSession(user.id, meta);

        await setBanned(admin.id, user.id, false);

        expect(await sessionCount(user.id)).toBe(1);
    });

    test("a non-admin cannot ban, and nothing changes", async () => {
        const user = await createTestUser("user-1");
        const target = await createTestUser("user-2");

        const result = await setBanned(user.id, target.id, true);

        expect(result).toEqual({ ok: false, reason: "not_admin" });
        expect((await getUser(target.id))?.banned_at).toBeNull();
    });

    test("an admin cannot ban themselves", async () => {
        const admin = await createTestAdmin();

        expect(await setBanned(admin.id, admin.id, true)).toEqual({ ok: false, reason: "self" });
        expect((await getUser(admin.id))?.banned_at).toBeNull();
    });

    test("a missing target reports no_user, for ban and unban", async () => {
        const admin = await createTestAdmin();

        expect(await setBanned(admin.id, 999999, true)).toEqual({ ok: false, reason: "no_user" });
        expect(await setBanned(admin.id, 999999, false)).toEqual({ ok: false, reason: "no_user" });
    });

    test("an admin must be demoted before they can be banned", async () => {
        const admin = await createTestAdmin("admin-1");
        const other = await createTestAdmin("admin-2");
        await createSession(other.id, meta);

        const result = await setBanned(admin.id, other.id, true);

        expect(result).toEqual({ ok: false, reason: "target_is_admin" });
        expect((await getUser(other.id))?.banned_at).toBeNull();
        expect(await sessionCount(other.id)).toBe(1);
    });

    test("a demoted admin can then be banned", async () => {
        const admin = await createTestAdmin("admin-1");
        const other = await createTestAdmin("admin-2");
        await setRole(admin.id, other.id, "user");

        const result = await setBanned(admin.id, other.id, true);

        expect(result.ok).toBe(true);
    });

    test("a banned admin can still be unbanned", async () => {
        const admin = await createTestAdmin("admin-1");
        const other = await createTestAdmin("admin-2");
        await pool.query("UPDATE app_user SET banned_at = NOW() WHERE id = $1", [other.id]);

        const result = await setBanned(admin.id, other.id, false);

        expect(result).toMatchObject({ ok: true, user: { banned_at: null } });
    });
});

describe("getSessionUser and bans", () => {
    test("a valid session for a banned user finds nothing", async () => {
        const user = await createTestUser();
        const { token } = await createSession(user.id, meta);
        expect(await getSessionUser(token)).toBeDefined();

        await pool.query("UPDATE app_user SET banned_at = NOW() WHERE id = $1", [user.id]);

        expect(await getSessionUser(token)).toBeUndefined();
    });

    test("an unbanned user's session works again", async () => {
        const user = await createTestUser();
        const { token } = await createSession(user.id, meta);
        await pool.query("UPDATE app_user SET banned_at = NOW() WHERE id = $1", [user.id]);
        await pool.query("UPDATE app_user SET banned_at = NULL WHERE id = $1", [user.id]);

        expect((await getSessionUser(token))?.user.id).toBe(user.id);
    });
});

describe("listUsers", () => {
    async function makeUsers(count: number) {
        const ids: number[] = [];
        for (let i = 1; i <= count; i++) ids.push((await createTestUser(`user-${i}`)).id);
        return ids;
    }

    test("returns an empty list and a zero total when there are no users", async () => {
        expect(await listUsers(2, 1)).toEqual({ users: [], total: 0 });
    });

    test("splits users across pages with the right total", async () => {
        await makeUsers(5);

        const page1 = await listUsers(2, 1);
        const page2 = await listUsers(2, 2);
        const page3 = await listUsers(2, 3);

        expect(page1.users).toHaveLength(2);
        expect(page2.users).toHaveLength(2);
        expect(page3.users).toHaveLength(1);
        expect(page1.total).toBe(5);
        expect(page3.total).toBe(5);
    });

    test("pages do not overlap and together cover everyone", async () => {
        const ids = await makeUsers(5);

        const all = [
            ...(await listUsers(2, 1)).users,
            ...(await listUsers(2, 2)).users,
            ...(await listUsers(2, 3)).users,
        ].map(u => u.id);

        expect(new Set(all).size).toBe(5);
        expect([...all].sort((a, b) => a - b)).toEqual(ids);
    });

    test("lists the newest users first", async () => {
        const ids = await makeUsers(3);

        const { users } = await listUsers(10, 1);

        expect(users.map(u => u.id)).toEqual([...ids].reverse());
    });

    test("a page past the end is empty but still reports the total", async () => {
        await makeUsers(3);

        const result = await listUsers(2, 9);

        expect(result.users).toEqual([]);
        expect(result.total).toBe(3);
    });

    test("total is a number, not a string", async () => {
        await makeUsers(1);

        expect(typeof (await listUsers(2, 1)).total).toBe("number");
    });
});
