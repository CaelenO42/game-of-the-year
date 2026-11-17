import { describe, expect, test } from "vitest";
import { idToCover, toApiGame, toApiGameStats, toApiUser } from "../src/api/serializers.js";
import type { GameDetail } from "../src/db/games.js";
import type { UserRow } from "../src/db/users.js";

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
    return {
        id: 7,
        firebase_uid: "secret-firebase-uid",
        username: "caelen",
        display_name: "Caelen",
        profile_picture: "https://example.com/pic.png",
        role: "user",
        username_changed_at: new Date("2026-01-01T00:00:00Z"),
        created_at: new Date("2026-02-03T04:05:06Z"),
        banned_at: null,
        ...overrides,
    };
}

function makeGame(overrides: Partial<GameDetail> = {}): GameDetail {
    return {
        id: 12,
        igdb_id: 99999,
        name: "Test Game",
        summary: "A game for testing.",
        cover_image_id: "co1abc",
        first_release_date: new Date("2020-11-19T00:00:00Z"),
        igdb_rating_count: 500,
        igdb_aggregated_rating: 88.5,
        igdb_aggregated_rating_count: 40,
        igdb_data: { id: 99999, name: "Test Game" } as unknown as GameDetail["igdb_data"],
        genres: [{ name: "Adventure", slug: "adventure" }],
        platforms: [{ name: "Nintendo Switch", abbreviation: "Switch", slug: "switch" }],
        ...overrides,
    };
}

describe("toApiUser", () => {
    test("maps a user to the public shape", () => {
        expect(toApiUser(makeUser())).toEqual({
            id: 7,
            username: "caelen",
            displayName: "Caelen",
            role: "user",
            createdAt: "2026-02-03T04:05:06.000Z",
        });
    });

    test("does not leak internal fields", () => {
        const result = toApiUser(makeUser({ banned_at: new Date() }));
        expect(result).not.toHaveProperty("firebase_uid");
        expect(result).not.toHaveProperty("banned_at");
        expect(result).not.toHaveProperty("username_changed_at");
        expect(result).not.toHaveProperty("profile_picture");
        expect(JSON.stringify(result)).not.toContain("secret-firebase-uid");
    });

    test("passes nulls through for users without a username or display name", () => {
        const result = toApiUser(makeUser({ username: null, display_name: null }));
        expect(result.username).toBeNull();
        expect(result.displayName).toBeNull();
    });

    test("includes the role for admins", () => {
        expect(toApiUser(makeUser({ role: "admin" })).role).toBe("admin");
    });
});

describe("toApiGame", () => {
    test("maps a game to the public shape", () => {
        expect(toApiGame(makeGame())).toEqual({
            id: 12,
            name: "Test Game",
            summary: "A game for testing.",
            releaseDate: "2020-11-19",
            coverUrl: idToCover("co1abc"),
            genres: [{ name: "Adventure", slug: "adventure" }],
            platforms: [{ name: "Nintendo Switch", abbreviation: "Switch", slug: "switch" }],
        });
    });

    test("does not leak IGDB internals", () => {
        const result = toApiGame(makeGame());
        expect(result).not.toHaveProperty("igdb_id");
        expect(result).not.toHaveProperty("igdb_data");
        expect(result).not.toHaveProperty("igdb_rating_count");
        expect(result).not.toHaveProperty("igdb_aggregated_rating");
        expect(result).not.toHaveProperty("igdb_aggregated_rating_count");
        expect(result).not.toHaveProperty("cover_image_id");
    });

    test("formats the release date as YYYY-MM-DD", () => {
        const result = toApiGame(makeGame({ first_release_date: new Date("2021-03-05T00:00:00Z") }));
        expect(result.releaseDate).toBe("2021-03-05");
    });

    test("handles a game with no summary, release date or cover", () => {
        const result = toApiGame(makeGame({ summary: null, first_release_date: null, cover_image_id: null }));
        expect(result.summary).toBeNull();
        expect(result.releaseDate).toBeNull();
        expect(result.coverUrl).toBeNull();
    });

    test("handles a game with no genres or platforms", () => {
        const result = toApiGame(makeGame({ genres: [], platforms: [] }));
        expect(result.genres).toEqual([]);
        expect(result.platforms).toEqual([]);
    });

    test("keeps a null platform abbreviation", () => {
        const result = toApiGame(makeGame({ platforms: [{ name: "PC", abbreviation: null, slug: "pc" }] }));
        expect(result.platforms[0]).toEqual({ name: "PC", abbreviation: null, slug: "pc" });
    });
});

describe("toApiGameStats", () => {
    test("maps stats with the game's id and name", () => {
        expect(toApiGameStats(makeGame(), { average: 82.5, count: 4 })).toEqual({
            id: 12,
            name: "Test Game",
            count: 4,
            average: 82.5,
        });
    });

    test("returns a null average when nobody has rated the game", () => {
        expect(toApiGameStats(makeGame(), { average: null, count: 0 })).toMatchObject({
            average: null,
            count: 0,
        });
    });

    test("does not leak game internals", () => {
        const result = toApiGameStats(makeGame(), { average: 80, count: 1 });
        expect(result).not.toHaveProperty("igdb_id");
        expect(result).not.toHaveProperty("igdb_data");
    });
});

describe("idToCover", () => {
    test("builds the IGDB cover URL from an image id", () => {
        expect(idToCover("co1abc")).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg");
    });
});
