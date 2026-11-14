import { describe, expect, test } from "vitest";
import { isRole, validateRole } from "../src/roles.js";

describe("isRole", () => {
    test.each(["admin", "user"])("accepts %s", (value) => {
        expect(isRole(value)).toBe(true);
    });

    test.each(["Admin", " admin ", "", "moderator", null, undefined, 5, {}, []])(
        "rejects %j",
        (value) => {
            expect(isRole(value)).toBe(false);
        },
    );
});

describe("validateRole", () => {
    test.each(["admin", "user"])("accepts %s", (value) => {
        expect(validateRole(value)).toEqual({ ok: true, role: value });
    });

    test("trims whitespace and returns the trimmed value", () => {
        expect(validateRole("  admin ")).toEqual({ ok: true, role: "admin" });
    });

    test.each(["Admin", "moderator", "", "   ", null, undefined, 5, true, {}, []])(
        "rejects %j",
        (value) => {
            expect(validateRole(value).ok).toBe(false);
        },
    );

    test("the error message lists the valid roles", () => {
        const result = validateRole("nope");
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/Role must be one of admin, user/);
    });
});
