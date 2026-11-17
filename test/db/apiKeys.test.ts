import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { pool } from "../../src/db/pool.js";
import { createApiKey, deleteApiKeyById, getApiKeyUser, listApiKeys, touchApiKey } from "../../src/db/apiKeys.js";
import { hashToken } from "../../src/lib/token.js";
import { createTestUser, resetDb } from "../helpers/db.js";

beforeEach(resetDb);
afterAll(() => pool.end());

async function getLastUsedAt(id: number): Promise<Date | null> {
    const result = await pool.query<{ last_used_at: Date | null }>(
        "SELECT last_used_at FROM api_key WHERE id = $1", [id]);
    return result.rows[0]!.last_used_at;
}

describe("apiKeys", () => {
    test("a created key can be used to find its user", async () => {
        const user = await createTestUser();
        const { key } = await createApiKey(user.id, "my key");

        const found = await getApiKeyUser(key);
        expect(found?.user.id).toBe(user.id);
    });

    test("the raw key is never stored, only its hash and prefix", async () => {
        const user = await createTestUser();
        const { id, key, key_prefix } = await createApiKey(user.id, "my key");

        expect(key.startsWith("goty_")).toBe(true);
        expect(key_prefix).toBe(key.slice(0, 11));

        const result = await pool.query<{ key_hash: Buffer, key_prefix: string }>(
            "SELECT key_hash, key_prefix FROM api_key WHERE id = $1", [id]);
        const row = result.rows[0]!;

        expect(row.key_hash.equals(hashToken(key))).toBe(true);
        expect(row.key_prefix).toBe(key_prefix);
        expect(row.key_prefix).not.toBe(key);
    });

    test("an unknown key finds nothing", async () => {
        expect(await getApiKeyUser("goty_not-a-real-key")).toBeUndefined();
    });

    test("a banned user's key is refused", async () => {
        const user = await createTestUser();
        const { key } = await createApiKey(user.id, "my key");
        await pool.query("UPDATE app_user SET banned_at = NOW() WHERE id = $1", [user.id]);

        expect(await getApiKeyUser(key)).toBeUndefined();
    });

    test("deleteApiKeyById invalidates the key", async () => {
        const user = await createTestUser();
        const { id, key } = await createApiKey(user.id, "my key");

        expect(await deleteApiKeyById(user.id, id)).toBe(1);
        expect(await getApiKeyUser(key)).toBeUndefined();
    });

    test("a user cannot delete another user's key", async () => {
        const owner = await createTestUser();
        const other = await createTestUser("other-uid");
        const { id, key } = await createApiKey(owner.id, "my key");

        expect(await deleteApiKeyById(other.id, id)).toBe(0);
        expect((await getApiKeyUser(key))?.user.id).toBe(owner.id);
    });

    test("touchApiKey sets last_used_at the first time", async () => {
        const user = await createTestUser();
        const { id } = await createApiKey(user.id, "my key");
        expect(await getLastUsedAt(id)).toBeNull();

        await touchApiKey(id);
        expect(await getLastUsedAt(id)).not.toBeNull();
    });

    test("touchApiKey is throttled within the interval", async () => {
        const user = await createTestUser();
        const { id } = await createApiKey(user.id, "my key");

        await touchApiKey(id);
        const first = await getLastUsedAt(id);
        await touchApiKey(id);
        const second = await getLastUsedAt(id);

        expect(second).toEqual(first);
    });

    test("touchApiKey updates once the interval has passed", async () => {
        const user = await createTestUser();
        const { id } = await createApiKey(user.id, "my key");
        await pool.query(
            "UPDATE api_key SET last_used_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [id]);
        const before = await getLastUsedAt(id);

        await touchApiKey(id);
        const after = await getLastUsedAt(id);

        expect(after!.getTime()).toBeGreaterThan(before!.getTime());
    });

    test("listApiKeys returns only the user's keys, newest first, without hashes", async () => {
        const user = await createTestUser();
        const other = await createTestUser("other-uid");
        const first = await createApiKey(user.id, "first");
        const second = await createApiKey(user.id, "second");
        await createApiKey(other.id, "not mine");

        const keys = await listApiKeys(user.id);

        expect(keys.map(k => k.id)).toEqual([second.id, first.id]);
        for (const k of keys) {
            expect(k).not.toHaveProperty("key_hash");
        }
    });
});
