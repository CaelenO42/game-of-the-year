import { describe, expect, test } from "vitest";
import { validateUsername } from "../src/username.js";

describe("validateUsername", () => {
    test("accepts a normal name and lowercases it", () => {
        expect(validateUsername("Caelen")).toEqual({ ok: true, username: "caelen" });
    });

    test("trims whitespace", () => {
        expect(validateUsername("  caelen  ")).toMatchObject({ ok: true, username: "caelen" });
    });

    test.each(["ab", "a".repeat(33), "-bob", "bob_", "has space", "bad!"])(
        "rejects %s",
        (name) => {
            expect(validateUsername(name).ok).toBe(false);
        },
    );

    test("rejects protected names regardless of case", () => {
        expect(validateUsername("ADMIN").ok).toBe(false);
    });

    test("rejects non-strings", () => {
        expect(validateUsername(undefined).ok).toBe(false);
        expect(validateUsername(42).ok).toBe(false);
    });
});
