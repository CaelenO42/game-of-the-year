import { describe, expect, test } from "vitest";
import { isStatus, validateRating, validateStatus } from "../src/validation/userGame.js";

describe("validateRating", () => {
    test.each([
        [85, 85],
        ["85", 85],
        [" 85 ", 85],
        [0, 0],
        ["0", 0],
        [100, 100],
        ["100", 100],
    ])("accepts %j as %i", (input, expected) => {
        expect(validateRating(input)).toEqual({ ok: true, rating: expected });
    });

    test.each([
        [85.4, 85],
        [85.5, 86],
        ["85.4", 85],
        ["85.5", 86],
    ])("rounds %j to %i", (input, expected) => {
        expect(validateRating(input)).toEqual({ ok: true, rating: expected });
    });

    test.each([
        [101, 100],
        [1000, 100],
        ["150", 100],
        [-1, 0],
        ["-5", 0],
        [-0.4, 0],
    ])("clamps %j to %i", (input, expected) => {
        expect(validateRating(input)).toEqual({ ok: true, rating: expected });
    });

    test.each([null, "", "   "])("treats %j as clearing the rating", (input) => {
        expect(validateRating(input)).toEqual({ ok: true, rating: null });
    });

    test.each([
        "abc",
        "85abc",
        "1e2",
        "0x10",
        "Infinity",
        "8 5",
        ".5",
        NaN,
        Infinity,
        -Infinity,
        true,
        {},
        [],
        [85],
        undefined,
    ])("rejects %j", (input) => {
        expect(validateRating(input).ok).toBe(false);
    });

    test("rejects a string of digits too long to be finite", () => {
        expect(validateRating("9".repeat(400)).ok).toBe(false);
    });

    test("error results carry a message", () => {
        const result = validateRating("abc");
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/0 and 100/);
    });
});

describe("isStatus", () => {
    test.each(["playing", "completed", "plan_to_play", "on_hold", "dropped"])(
        "accepts %s",
        (value) => {
            expect(isStatus(value)).toBe(true);
        },
    );

    test.each(["Playing", " playing ", "", "finished", null, undefined, 5, {}])(
        "rejects %j",
        (value) => {
            expect(isStatus(value)).toBe(false);
        },
    );
});

describe("validateStatus", () => {
    test.each(["playing", "completed", "plan_to_play", "on_hold", "dropped"])(
        "accepts %s",
        (value) => {
            expect(validateStatus(value)).toEqual({ ok: true, status: value });
        },
    );

    test("trims whitespace and returns the trimmed value", () => {
        expect(validateStatus("  playing ")).toEqual({ ok: true, status: "playing" });
    });

    test.each([null, "", "   "])("treats %j as clearing the status", (input) => {
        expect(validateStatus(input)).toEqual({ ok: true, status: null });
    });

    test.each(["Playing", "finished", "plan to play", 5, true, {}, [], undefined])(
        "rejects %j",
        (input) => {
            expect(validateStatus(input).ok).toBe(false);
        },
    );

    test("the error message lists the valid statuses", () => {
        const result = validateStatus("nope");
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain("plan_to_play");
    });
});
