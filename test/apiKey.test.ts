import { describe, expect, test } from "vitest";
import { API_KEY_MAX_LENGTH, validateApiKeyName } from "../src/validation/apiKey.js";

describe("validateApiKeyName", () => {
    test("accepts a normal name", () => {
        expect(validateApiKeyName("my laptop")).toEqual({ ok: true, name: "my laptop" });
    });

    test("trims leading and trailing whitespace", () => {
        expect(validateApiKeyName("  ci server \n")).toEqual({ ok: true, name: "ci server" });
    });

    test("keeps punctuation, unicode and emoji", () => {
        expect(validateApiKeyName("Café (dev.local) 🎮")).toMatchObject({
            ok: true,
            name: "Café (dev.local) 🎮",
        });
    });

    test("rejects an empty name", () => {
        expect(validateApiKeyName("")).toMatchObject({ ok: false });
    });

    test("rejects a whitespace-only name", () => {
        expect(validateApiKeyName("   \t \n ")).toMatchObject({ ok: false });
    });

    test("accepts a name at the max length", () => {
        const name = "a".repeat(API_KEY_MAX_LENGTH);
        expect(validateApiKeyName(name)).toEqual({ ok: true, name });
    });

    test("rejects a name over the max length", () => {
        expect(validateApiKeyName("a".repeat(API_KEY_MAX_LENGTH + 1))).toMatchObject({ ok: false });
    });

    test("measures length after trimming", () => {
        const name = "a".repeat(API_KEY_MAX_LENGTH);
        expect(validateApiKeyName(`   ${name}   `)).toEqual({ ok: true, name });
    });

    test("rejects newlines, tabs and null bytes inside the name", () => {
        expect(validateApiKeyName("one\ntwo")).toMatchObject({ ok: false });
        expect(validateApiKeyName("one\ttwo")).toMatchObject({ ok: false });
        expect(validateApiKeyName("one\u0000two")).toMatchObject({ ok: false });
    });

    test("rejects values that are not strings", () => {
        for (const value of [undefined, null, 42, true, ["name"], { name: "x" }]) {
            expect(validateApiKeyName(value)).toMatchObject({ ok: false });
        }
    });

    test("uses different messages for empty and too-long names", () => {
        const empty = validateApiKeyName("");
        const long = validateApiKeyName("a".repeat(API_KEY_MAX_LENGTH + 1));
        expect(empty.ok || long.ok).toBe(false);
        if (!empty.ok && !long.ok) expect(empty.error).not.toBe(long.error);
    });
});
