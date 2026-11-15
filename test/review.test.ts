import { describe, expect, test } from "vitest";
import { REVIEW_MAX_LENGTH, validateReviewBody } from "../src/validation/review.js";

describe("validateReviewBody: text", () => {
    test("accepts normal text", () => {
        expect(validateReviewBody("Great game", undefined)).toEqual({
            ok: true,
            review: "Great game",
            spoilers: false,
        });
    });

    test("trims leading and trailing whitespace", () => {
        expect(validateReviewBody("  \n  Great game  \n ", undefined)).toMatchObject({
            ok: true,
            review: "Great game",
        });
    });

    test("keeps tabs, newlines and internal blank lines", () => {
        expect(validateReviewBody("one\n\ntwo\tthree", undefined)).toMatchObject({
            ok: true,
            review: "one\n\ntwo\tthree",
        });
    });

    test("keeps unicode and emoji", () => {
        expect(validateReviewBody("Très bon jeu 🎮", undefined)).toMatchObject({
            ok: true,
            review: "Très bon jeu 🎮",
        });
    });

    test.each(["", "   ", "\n\n", "\t \r\n"])("rejects empty or whitespace-only text (%j)", (text) => {
        expect(validateReviewBody(text, undefined).ok).toBe(false);
    });

    test.each([undefined, null, 5, true, {}, [], ["a"]])("rejects non-string text (%j)", (text) => {
        expect(validateReviewBody(text, undefined).ok).toBe(false);
    });
});

describe("validateReviewBody: line endings", () => {
    test("converts CRLF to LF", () => {
        expect(validateReviewBody("a\r\nb", undefined)).toMatchObject({ ok: true, review: "a\nb" });
    });

    test("converts a lone CR to LF", () => {
        expect(validateReviewBody("a\rb", undefined)).toMatchObject({ ok: true, review: "a\nb" });
    });

    test("converts a mix of line endings", () => {
        expect(validateReviewBody("a\r\nb\rc\nd", undefined)).toMatchObject({ ok: true, review: "a\nb\nc\nd" });
    });

    test("counts a CRLF as one character toward the limit", () => {
        // 2 chars per line as sent by the browser, but only 1 after normalizing
        const text = "x\r\n".repeat(REVIEW_MAX_LENGTH / 2);
        expect(text.length).toBeGreaterThan(REVIEW_MAX_LENGTH);
        expect(validateReviewBody(text, undefined).ok).toBe(true);
    });
});

describe("validateReviewBody: length", () => {
    test("accepts text of exactly the maximum length", () => {
        expect(validateReviewBody("x".repeat(REVIEW_MAX_LENGTH), undefined).ok).toBe(true);
    });

    test("rejects text one character over the maximum", () => {
        const result = validateReviewBody("x".repeat(REVIEW_MAX_LENGTH + 1), undefined);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain(String(REVIEW_MAX_LENGTH));
    });

    test("does not count surrounding whitespace toward the limit", () => {
        const text = "  " + "x".repeat(REVIEW_MAX_LENGTH) + "  ";
        expect(validateReviewBody(text, undefined).ok).toBe(true);
    });
});

describe("validateReviewBody: control characters", () => {
    test.each([
        ["NUL", "a\u0000b"],
        ["bell", "a\u0007b"],
        ["escape", "a\u001bb"],
        ["vertical tab", "a\u000bb"],
        ["form feed", "a\u000cb"],
        ["delete", "a\u007fb"],
    ])("rejects %s", (_name, text) => {
        const result = validateReviewBody(text, undefined);
        expect(result.ok).toBe(false);
    });

    test("rejects a control character even at the very start or end of the text", () => {
        expect(validateReviewBody("\u0000hello", undefined).ok).toBe(false);
        expect(validateReviewBody("hello\u0000", undefined).ok).toBe(false);
    });
});

describe("validateReviewBody: spoiler flag", () => {
    test.each(["true", "on"])("treats %j as spoilers", (spoiler) => {
        expect(validateReviewBody("text", spoiler)).toMatchObject({ ok: true, spoilers: true });
    });

    test.each([undefined, null, "", "false", "off", "maybe", 1, true])(
        "treats %j as no spoilers",
        (spoiler) => {
            expect(validateReviewBody("text", spoiler)).toMatchObject({ ok: true, spoilers: false });
        },
    );

    test("an unticked checkbox (field missing) is valid", () => {
        expect(validateReviewBody("text", undefined).ok).toBe(true);
    });
});
