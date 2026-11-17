import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { pool } from "../../src/db/pool.js";
import { deleteReview, deleteReviewById, getReview, getUserReview, listReviewsForGame, setReview } from "../../src/db/userReviews.js";
import { setRating } from "../../src/db/userGames.js";
import { createTestGame, createTestUser, resetDb } from "../helpers/db.js";

beforeEach(resetDb);
afterAll(() => pool.end());

async function setup() {
    const user = await createTestUser();
    const game = await createTestGame();
    return { user, game };
}

async function reviewCount() {
    const r = await pool.query("SELECT COUNT(*)::int AS n FROM user_review");
    return r.rows[0].n as number;
}

async function nameUser(userId: number, username: string, displayName: string | null = null) {
    await pool.query("UPDATE app_user SET username = $2, display_name = $3 WHERE id = $1", [userId, username, displayName]);
}

// Make a review look like it was written `hours` ago, so ordering tests don't depend on timing.
async function ageReview(userId: number, gameId: number, hours: number) {
    await pool.query(
        "UPDATE user_review SET created_at = NOW() - make_interval(hours => $3) WHERE user_id = $1 AND game_id = $2",
        [userId, gameId, hours],
    );
}

describe("setReview", () => {
    test("creates a review", async () => {
        const { user, game } = await setup();

        const row = await setReview(user.id, game.id, "Loved it", false);

        expect(row).toMatchObject({ user_id: user.id, game_id: game.id, body: "Loved it", contains_spoilers: false });
        expect(row.created_at).toBeInstanceOf(Date);
        expect(await reviewCount()).toBe(1);
    });

    test("stores the spoiler flag", async () => {
        const { user, game } = await setup();

        const row = await setReview(user.id, game.id, "The butler did it", true);

        expect(row.contains_spoilers).toBe(true);
    });

    test("saving again edits the same review instead of adding another", async () => {
        const { user, game } = await setup();
        const first = await setReview(user.id, game.id, "First take", false);

        const second = await setReview(user.id, game.id, "Second take", true);

        expect(second.id).toBe(first.id);
        expect(second).toMatchObject({ body: "Second take", contains_spoilers: true });
        expect(await reviewCount()).toBe(1);
    });

    test("editing keeps created_at and moves updated_at forward", async () => {
        const { user, game } = await setup();
        await setReview(user.id, game.id, "First take", false);
        await pool.query("UPDATE user_review SET created_at = NOW() - INTERVAL '2 days', updated_at = NOW() - INTERVAL '2 days'");
        const before = (await getUserReview(user.id, game.id))!;

        const after = await setReview(user.id, game.id, "Second take", false);

        expect(after.created_at.getTime()).toBe(before.created_at.getTime());
        expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
    });

    test("two users can review the same game", async () => {
        const { user, game } = await setup();
        const other = await createTestUser("other-uid");

        await setReview(user.id, game.id, "Mine", false);
        await setReview(other.id, game.id, "Theirs", false);

        expect(await reviewCount()).toBe(2);
    });

    test("one user can review different games", async () => {
        const { user, game } = await setup();
        const otherGame = await createTestGame(2, "Other Game");

        await setReview(user.id, game.id, "One", false);
        await setReview(user.id, otherGame.id, "Two", false);

        expect(await reviewCount()).toBe(2);
    });

    test("rejects an unknown game", async () => {
        const { user } = await setup();

        await expect(setReview(user.id, 999999, "text", false)).rejects.toThrow();
    });

    test("rejects an unknown user", async () => {
        const { game } = await setup();

        await expect(setReview(999999, game.id, "text", false)).rejects.toThrow();
    });
});

describe("getUserReview", () => {
    test("returns undefined when the user has not reviewed the game", async () => {
        const { user, game } = await setup();

        expect(await getUserReview(user.id, game.id)).toBeUndefined();
    });

    test("returns the user's review", async () => {
        const { user, game } = await setup();
        await setReview(user.id, game.id, "Loved it", false);

        expect(await getUserReview(user.id, game.id)).toMatchObject({ body: "Loved it" });
    });

    test("does not return someone else's review", async () => {
        const { user, game } = await setup();
        const other = await createTestUser("other-uid");
        await setReview(other.id, game.id, "Theirs", false);

        expect(await getUserReview(user.id, game.id)).toBeUndefined();
    });

    test("does not return the same user's review of a different game", async () => {
        const { user, game } = await setup();
        const otherGame = await createTestGame(2, "Other Game");
        await setReview(user.id, otherGame.id, "Elsewhere", false);

        expect(await getUserReview(user.id, game.id)).toBeUndefined();
    });
});

describe("getReview", () => {
    test("returns undefined when there is no review", async () => {
        const { user, game } = await setup();

        expect(await getReview(user.id, game.id)).toBeUndefined();
    });

    test("includes the author's username and display name", async () => {
        const { user, game } = await setup();
        await nameUser(user.id, "alice", "Alice A.");
        await setReview(user.id, game.id, "Loved it", false);

        expect(await getReview(user.id, game.id)).toMatchObject({
            body: "Loved it",
            username: "alice",
            display_name: "Alice A.",
        });
    });

    test("includes the author's rating when they rated the game", async () => {
        const { user, game } = await setup();
        await setRating(user.id, game.id, 85);
        await setReview(user.id, game.id, "Loved it", false);

        expect((await getReview(user.id, game.id))?.rating).toBe(85);
    });

    test("still returns a review written without a rating (rating is null)", async () => {
        const { user, game } = await setup();
        await setReview(user.id, game.id, "No score from me", false);

        const review = await getReview(user.id, game.id);

        expect(review).toBeDefined();
        expect(review?.rating).toBeNull();
    });

    test("still returns a review when the user only has other data for the game", async () => {
        const { user, game } = await setup();
        await pool.query("INSERT INTO user_game (user_id, game_id, status) VALUES ($1, $2, 'playing')", [user.id, game.id]);
        await setReview(user.id, game.id, "Still playing", false);

        expect((await getReview(user.id, game.id))?.rating).toBeNull();
    });

    test("does not pick up the author's rating for a different game", async () => {
        const { user, game } = await setup();
        const otherGame = await createTestGame(2, "Other Game");
        await setRating(user.id, otherGame.id, 99);
        await setReview(user.id, game.id, "Loved it", false);

        expect((await getReview(user.id, game.id))?.rating).toBeNull();
    });

    test("does not pick up another user's rating for the same game", async () => {
        const { user, game } = await setup();
        const other = await createTestUser("other-uid");
        await setRating(other.id, game.id, 10);
        await setReview(user.id, game.id, "Loved it", false);

        expect((await getReview(user.id, game.id))?.rating).toBeNull();
    });

    test("returns a single row, not one per matching join", async () => {
        const { user, game } = await setup();
        await setRating(user.id, game.id, 70);
        await setReview(user.id, game.id, "Loved it", false);

        expect(await getReview(user.id, game.id)).toMatchObject({ id: expect.any(Number), rating: 70 });
    });
});

describe("listReviewsForGame", () => {
    async function makeReviewers(game: { id: number }, count: number) {
        const ids: number[] = [];
        for (let i = 1; i <= count; i++) {
            const u = await createTestUser(`user-${i}`);
            await nameUser(u.id, `user${i}`);
            await setReview(u.id, game.id, `Review ${i}`, false);
            // user 1 is the oldest, the last user is the newest
            await ageReview(u.id, game.id, count - i + 1);
            ids.push(u.id);
        }
        return ids;
    }

    test("returns an empty list and a zero total when there are no reviews", async () => {
        const { game } = await setup();

        expect(await listReviewsForGame(game.id, 10, 1)).toEqual({ reviews: [], total: 0 });
    });

    test("lists the newest reviews first", async () => {
        const { game } = await setup();
        const ids = await makeReviewers(game, 3);

        const { reviews } = await listReviewsForGame(game.id, 10, 1);

        expect(reviews.map(r => r.user_id)).toEqual([...ids].reverse());
    });

    test("page 1 holds the newest reviews and page 2 the next ones", async () => {
        const { game } = await setup();
        const ids = await makeReviewers(game, 5); // newest first: ids[4], ids[3], ids[2], ids[1], ids[0]

        const page1 = await listReviewsForGame(game.id, 2, 1);
        const page2 = await listReviewsForGame(game.id, 2, 2);
        const page3 = await listReviewsForGame(game.id, 2, 3);

        expect(page1.reviews.map(r => r.user_id)).toEqual([ids[4], ids[3]]);
        expect(page2.reviews.map(r => r.user_id)).toEqual([ids[2], ids[1]]);
        expect(page3.reviews.map(r => r.user_id)).toEqual([ids[0]]);
    });

    test("pages do not overlap and together cover every review", async () => {
        const { game } = await setup();
        await makeReviewers(game, 5);

        const all = [
            ...(await listReviewsForGame(game.id, 2, 1)).reviews,
            ...(await listReviewsForGame(game.id, 2, 2)).reviews,
            ...(await listReviewsForGame(game.id, 2, 3)).reviews,
        ].map(r => r.id);

        expect(new Set(all).size).toBe(5);
    });

    test("total counts every review for the game on every page", async () => {
        const { game } = await setup();
        await makeReviewers(game, 5);

        expect((await listReviewsForGame(game.id, 2, 1)).total).toBe(5);
        expect((await listReviewsForGame(game.id, 2, 3)).total).toBe(5);
    });

    test("only lists and counts reviews for the requested game", async () => {
        const { game } = await setup();
        const otherGame = await createTestGame(2, "Other Game");
        await makeReviewers(game, 3);
        const stranger = await createTestUser("stranger");
        await setReview(stranger.id, otherGame.id, "Elsewhere", false);

        const result = await listReviewsForGame(game.id, 10, 1);

        expect(result.total).toBe(3);
        expect(result.reviews.every(r => r.game_id === game.id)).toBe(true);
    });

    test("includes author names and ratings, with null for reviewers who did not rate", async () => {
        const { game } = await setup();
        const rated = await createTestUser("rated");
        const unrated = await createTestUser("unrated");
        await nameUser(rated.id, "rated_user");
        await nameUser(unrated.id, "unrated_user");
        await setRating(rated.id, game.id, 90);
        await setReview(rated.id, game.id, "Scored", false);
        await setReview(unrated.id, game.id, "No score", false);

        const { reviews } = await listReviewsForGame(game.id, 10, 1);
        const byName = Object.fromEntries(reviews.map(r => [r.username, r.rating]));

        expect(byName).toEqual({ rated_user: 90, unrated_user: null });
    });

    test("a page past the end is empty but still reports the total", async () => {
        const { game } = await setup();
        await makeReviewers(game, 3);

        const result = await listReviewsForGame(game.id, 2, 9);

        expect(result.reviews).toEqual([]);
        expect(result.total).toBe(3);
    });

    test("total is a number, not a string", async () => {
        const { game } = await setup();
        await makeReviewers(game, 1);

        expect(typeof (await listReviewsForGame(game.id, 10, 1)).total).toBe("number");
    });
});

describe("deleteReview", () => {
    test("deletes the review and returns 1", async () => {
        const { user, game } = await setup();
        await setReview(user.id, game.id, "Loved it", false);

        expect(await deleteReview(user.id, game.id)).toBe(1);
        expect(await getUserReview(user.id, game.id)).toBeUndefined();
    });

    test("deleting again returns 0 and does not throw", async () => {
        const { user, game } = await setup();
        await setReview(user.id, game.id, "Loved it", false);
        await deleteReview(user.id, game.id);

        expect(await deleteReview(user.id, game.id)).toBe(0);
    });

    test("returns 0 when there was never a review", async () => {
        const { user, game } = await setup();

        expect(await deleteReview(user.id, game.id)).toBe(0);
    });

    test("does not delete another user's review of the same game", async () => {
        const { user, game } = await setup();
        const other = await createTestUser("other-uid");
        await setReview(other.id, game.id, "Theirs", false);

        await deleteReview(user.id, game.id);

        expect(await getUserReview(other.id, game.id)).toBeDefined();
    });

    test("does not delete the same user's review of a different game", async () => {
        const { user, game } = await setup();
        const otherGame = await createTestGame(2, "Other Game");
        await setReview(user.id, otherGame.id, "Elsewhere", false);

        await deleteReview(user.id, game.id);

        expect(await getUserReview(user.id, otherGame.id)).toBeDefined();
    });

    test("does not touch the user's rating", async () => {
        const { user, game } = await setup();
        await setRating(user.id, game.id, 80);
        await setReview(user.id, game.id, "Loved it", false);

        await deleteReview(user.id, game.id);

        const r = await pool.query("SELECT rating FROM user_game WHERE user_id = $1 AND game_id = $2", [user.id, game.id]);
        expect(r.rows[0].rating).toBe(80);
    });
});

describe("deleteReviewById", () => {
    test("deletes the review and returns its game id", async () => {
        const { user, game } = await setup();
        const review = await setReview(user.id, game.id, "Loved it", false);

        const gameId = await deleteReviewById(review.id);

        expect(gameId).toBe(game.id);
        expect(await getUserReview(user.id, game.id)).toBeUndefined();
    });

    test("returns undefined for an unknown id", async () => {
        expect(await deleteReviewById(999999)).toBeUndefined();
    });

    test("leaves other reviews alone", async () => {
        const { user, game } = await setup();
        const other = await createTestUser("other-uid");
        const mine = await setReview(user.id, game.id, "Loved it", false);
        await setReview(other.id, game.id, "Meh", false);

        await deleteReviewById(mine.id);

        expect(await reviewCount()).toBe(1);
        expect(await getUserReview(other.id, game.id)).toBeDefined();
    });

    test("keeps the author's rating", async () => {
        const { user, game } = await setup();
        const review = await setReview(user.id, game.id, "Loved it", false);
        await setRating(user.id, game.id, 80);

        await deleteReviewById(review.id);

        const r = await pool.query("SELECT rating FROM user_game WHERE user_id = $1 AND game_id = $2", [user.id, game.id]);
        expect(r.rows[0].rating).toBe(80);
    });
});

describe("cascading deletes", () => {
    test("deleting a user removes their reviews", async () => {
        const { user, game } = await setup();
        await setReview(user.id, game.id, "Loved it", false);

        await pool.query("DELETE FROM app_user WHERE id = $1", [user.id]);

        expect(await reviewCount()).toBe(0);
    });

    test("deleting a game removes its reviews", async () => {
        const { user, game } = await setup();
        await setReview(user.id, game.id, "Loved it", false);

        await pool.query("DELETE FROM game WHERE id = $1", [game.id]);

        expect(await reviewCount()).toBe(0);
    });
});
