import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { pool } from "../../src/db/pool.js";
import { createTestGame, createTestUser, resetDb } from "../helpers/db.js";
import {
    getGameStats,
    getUserGame,
    setFavorite,
    setLibrary,
    setRating,
    setStatus,
} from "../../src/db/userGames.js";

beforeEach(resetDb);
afterAll(() => pool.end());

async function rowCount() {
    const r = await pool.query("SELECT COUNT(*)::int AS n FROM user_game");
    return r.rows[0].n;
}

async function setup() {
    const user = await createTestUser();
    const game = await createTestGame();
    return { user, game };
}

describe("setStatus", () => {
    test("creates a row with only the status set", async () => {
        const { user, game } = await setup();

        const row = await setStatus(user.id, game.id, "playing");

        expect(row?.status).toBe("playing");
        expect(row?.rating).toBeNull();
        expect(row?.favorited_at).toBeNull();
        expect(row?.library_added_at).toBeNull();
        expect(await rowCount()).toBe(1);
    });

    test("replaces an existing status without creating a second row", async () => {
        const { user, game } = await setup();
        await setStatus(user.id, game.id, "playing");

        const row = await setStatus(user.id, game.id, "completed");

        expect(row?.status).toBe("completed");
        expect(await rowCount()).toBe(1);
    });

    test("clearing the only field deletes the row", async () => {
        const { user, game } = await setup();
        await setStatus(user.id, game.id, "playing");

        expect(await setStatus(user.id, game.id, null)).toBeUndefined();
        expect(await rowCount()).toBe(0);
    });

    test("updates updated_at when the status changes", async () => {
        const { user, game } = await setup();
        await setStatus(user.id, game.id, "playing");
        await pool.query("UPDATE user_game SET updated_at = NOW() - INTERVAL '1 day'");
        const before = (await getUserGame(user.id, game.id))!.updated_at;

        const row = await setStatus(user.id, game.id, "completed");

        expect(row!.updated_at.getTime()).toBeGreaterThan(before.getTime());
    });
});

describe("setRating", () => {
    test("creates a row with only the rating set", async () => {
        const { user, game } = await setup();

        const row = await setRating(user.id, game.id, 85);

        expect(row?.rating).toBe(85);
        expect(row?.status).toBeNull();
        expect(row?.favorited_at).toBeNull();
        expect(await rowCount()).toBe(1);
    });

    test("stores a rating of 0 and keeps the row", async () => {
        const { user, game } = await setup();

        const row = await setRating(user.id, game.id, 0);

        expect(row?.rating).toBe(0);
        expect(await rowCount()).toBe(1);
    });

    test("replaces an existing rating", async () => {
        const { user, game } = await setup();
        await setRating(user.id, game.id, 50);

        const row = await setRating(user.id, game.id, 90);

        expect(row?.rating).toBe(90);
        expect(await rowCount()).toBe(1);
    });

    test("clearing the only field deletes the row", async () => {
        const { user, game } = await setup();
        await setRating(user.id, game.id, 85);

        const row = await setRating(user.id, game.id, null);

        expect(row).toBeUndefined();
        expect(await rowCount()).toBe(0);
    });

    test.each([101, -1])("rejects an out-of-range rating (%i)", async (rating) => {
        const { user, game } = await setup();

        await expect(setRating(user.id, game.id, rating)).rejects.toThrow();
        expect(await rowCount()).toBe(0);
    });

    test("rejects an unknown game", async () => {
        const { user } = await setup();

        await expect(setRating(user.id, 999999, 50)).rejects.toThrow();
    });

    test("rejects an unknown user", async () => {
        const { game } = await setup();

        await expect(setRating(999999, game.id, 50)).rejects.toThrow();
    });
});

describe("combining fields", () => {
    test("setting a second field keeps the first, in one row", async () => {
        const { user, game } = await setup();
        await setStatus(user.id, game.id, "playing");

        const row = await setRating(user.id, game.id, 70);

        expect(row?.status).toBe("playing");
        expect(row?.rating).toBe(70);
        expect(await rowCount()).toBe(1);
    });

    test("clearing one of two fields keeps the row and the other field", async () => {
        const { user, game } = await setup();
        await setStatus(user.id, game.id, "playing");
        await setRating(user.id, game.id, 70);

        const row = await setRating(user.id, game.id, null);

        expect(row?.rating).toBeNull();
        expect(row?.status).toBe("playing");
        expect(await rowCount()).toBe(1);
    });

    test("clearing a field on a game with no row returns undefined and creates nothing", async () => {
        const { user, game } = await setup();

        expect(await setRating(user.id, game.id, null)).toBeUndefined();
        expect(await setStatus(user.id, game.id, null)).toBeUndefined();
        expect(await setFavorite(user.id, game.id, false)).toBeUndefined();
        expect(await setLibrary(user.id, game.id, false)).toBeUndefined();
        expect(await rowCount()).toBe(0);
    });

    test("clearing an already-empty field leaves a row that holds something else untouched", async () => {
        const { user, game } = await setup();
        await setFavorite(user.id, game.id, true);

        const row = await setRating(user.id, game.id, null);

        expect(row?.rating).toBeNull();
        expect(row?.favorited_at).toBeInstanceOf(Date);
        expect(await rowCount()).toBe(1);
    });

    test("rows are per user and per game", async () => {
        const { user, game } = await setup();
        const otherUser = await createTestUser("other-uid");
        const otherGame = await createTestGame(2, "Other Game");

        await setRating(user.id, game.id, 10);
        await setRating(otherUser.id, game.id, 20);
        await setRating(user.id, otherGame.id, 30);

        expect(await rowCount()).toBe(3);
        expect((await getUserGame(user.id, game.id))?.rating).toBe(10);
        expect((await getUserGame(otherUser.id, game.id))?.rating).toBe(20);
        expect((await getUserGame(user.id, otherGame.id))?.rating).toBe(30);
    });
});

describe("favorite and library", () => {
    test("setFavorite(true) sets favorited_at", async () => {
        const { user, game } = await setup();

        const row = await setFavorite(user.id, game.id, true);

        expect(row?.favorited_at).toBeInstanceOf(Date);
        expect(row?.library_added_at).toBeNull();
    });

    test("favoriting twice keeps the original timestamp", async () => {
        const { user, game } = await setup();
        await setFavorite(user.id, game.id, true);
        await pool.query("UPDATE user_game SET favorited_at = NOW() - INTERVAL '1 day'");
        const original = (await getUserGame(user.id, game.id))!.favorited_at!;

        const row = await setFavorite(user.id, game.id, true);

        expect(row?.favorited_at?.getTime()).toBe(original.getTime());
        expect(await rowCount()).toBe(1);
    });

    test("setLibrary(true) sets library_added_at", async () => {
        const { user, game } = await setup();

        const row = await setLibrary(user.id, game.id, true);

        expect(row?.library_added_at).toBeInstanceOf(Date);
        expect(row?.favorited_at).toBeNull();
    });

    test("adding to the library twice keeps the original timestamp", async () => {
        const { user, game } = await setup();
        await setLibrary(user.id, game.id, true);
        await pool.query("UPDATE user_game SET library_added_at = NOW() - INTERVAL '1 day'");
        const original = (await getUserGame(user.id, game.id))!.library_added_at!;

        const row = await setLibrary(user.id, game.id, true);

        expect(row?.library_added_at?.getTime()).toBe(original.getTime());
    });

    test("favorite and library are independent", async () => {
        const { user, game } = await setup();
        await setFavorite(user.id, game.id, true);
        await setLibrary(user.id, game.id, true);

        const row = await setFavorite(user.id, game.id, false);

        expect(row?.favorited_at).toBeNull();
        expect(row?.library_added_at).toBeInstanceOf(Date);
        expect(await rowCount()).toBe(1);
    });

    test("adding then removing from the library leaves no row", async () => {
        const { user, game } = await setup();
        await setLibrary(user.id, game.id, true);

        await setLibrary(user.id, game.id, false);

        expect(await rowCount()).toBe(0);
    });

    test("favoriting then unfavoriting leaves no row", async () => {
        const { user, game } = await setup();
        await setFavorite(user.id, game.id, true);

        expect(await setFavorite(user.id, game.id, false)).toBeUndefined();
        expect(await rowCount()).toBe(0);
    });
});

describe("getUserGame", () => {
    test("returns undefined when the user has no row for the game", async () => {
        const { user, game } = await setup();

        expect(await getUserGame(user.id, game.id)).toBeUndefined();
    });

    test("returns the row with every field", async () => {
        const { user, game } = await setup();
        await setStatus(user.id, game.id, "completed");
        await setRating(user.id, game.id, 88);
        await setFavorite(user.id, game.id, true);
        await setLibrary(user.id, game.id, true);

        const row = await getUserGame(user.id, game.id);

        expect(row).toMatchObject({ user_id: user.id, game_id: game.id, status: "completed", rating: 88 });
        expect(row?.favorited_at).toBeInstanceOf(Date);
        expect(row?.library_added_at).toBeInstanceOf(Date);
        expect(row?.created_at).toBeInstanceOf(Date);
        expect(row?.updated_at).toBeInstanceOf(Date);
    });

    test("does not return another user's row", async () => {
        const { user, game } = await setup();
        const otherUser = await createTestUser("other-uid");
        await setRating(otherUser.id, game.id, 50);

        expect(await getUserGame(user.id, game.id)).toBeUndefined();
    });
});

describe("getGameStats", () => {
    test("a game with no ratings has a null average and a count of 0", async () => {
        const { game } = await setup();

        expect(await getGameStats(game.id)).toEqual({ average: null, count: 0 });
    });

    test("averages ratings across users", async () => {
        const { user, game } = await setup();
        const otherUser = await createTestUser("other-uid");
        await setRating(user.id, game.id, 80);
        await setRating(otherUser.id, game.id, 90);

        expect(await getGameStats(game.id)).toEqual({ average: 85, count: 2 });
    });

    test("returns numbers, not strings", async () => {
        const { user, game } = await setup();
        await setRating(user.id, game.id, 75);

        const stats = await getGameStats(game.id);

        expect(typeof stats.average).toBe("number");
        expect(typeof stats.count).toBe("number");
    });

    test("rows without a rating are not counted", async () => {
        const { user, game } = await setup();
        const otherUser = await createTestUser("other-uid");
        await setRating(user.id, game.id, 60);
        await setFavorite(otherUser.id, game.id, true);
        await setStatus(otherUser.id, game.id, "playing");

        expect(await getGameStats(game.id)).toEqual({ average: 60, count: 1 });
    });

    test("a rating of 0 is counted", async () => {
        const { user, game } = await setup();
        const otherUser = await createTestUser("other-uid");
        await setRating(user.id, game.id, 0);
        await setRating(otherUser.id, game.id, 100);

        expect(await getGameStats(game.id)).toEqual({ average: 50, count: 2 });
    });

    test("ignores ratings for other games", async () => {
        const { user, game } = await setup();
        const otherGame = await createTestGame(2, "Other Game");
        await setRating(user.id, game.id, 40);
        await setRating(user.id, otherGame.id, 100);

        expect(await getGameStats(game.id)).toEqual({ average: 40, count: 1 });
    });

    test("clearing a rating removes it from the stats", async () => {
        const { user, game } = await setup();
        await setRating(user.id, game.id, 40);
        await setRating(user.id, game.id, null);

        expect(await getGameStats(game.id)).toEqual({ average: null, count: 0 });
    });
});
