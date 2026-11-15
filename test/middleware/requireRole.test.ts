import { describe, expect, test, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireRole } from "../../src/middleware/auth.js";

function fakeReq(user: { role: string } | undefined, htmx = false) {
    return {
        user,
        get: (name: string) => (htmx && name.toLowerCase() === "hx-request" ? "true" : undefined),
    } as unknown as Request;
}

function fakeRes() {
    const res = {
        status: vi.fn(),
        render: vi.fn(),
        end: vi.fn(),
    };
    res.status.mockReturnValue(res);
    res.render.mockReturnValue(res);
    res.end.mockReturnValue(res);
    return res;
}

function run(req: Request, res: ReturnType<typeof fakeRes>) {
    const next = vi.fn();
    requireRole("admin")(req, res as unknown as Response, next as unknown as NextFunction);
    return next;
}

describe("requireRole('admin')", () => {
    test("lets an admin through", () => {
        const res = fakeRes();
        const next = run(fakeReq({ role: "admin" }), res);

        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    test("refuses a normal user with the 403 page", () => {
        const res = fakeRes();
        const next = run(fakeReq({ role: "user" }), res);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.render).toHaveBeenCalledWith("errors/403");
    });

    test("refuses a request with no user", () => {
        const res = fakeRes();
        const next = run(fakeReq(undefined), res);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test("an htmx request gets a bare 403 and no page", () => {
        const res = fakeRes();
        const next = run(fakeReq({ role: "user" }, true), res);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.end).toHaveBeenCalled();
        expect(res.render).not.toHaveBeenCalled();
    });

    test("an admin passes through on an htmx request too", () => {
        const res = fakeRes();
        const next = run(fakeReq({ role: "admin" }, true), res);

        expect(next).toHaveBeenCalledOnce();
    });
});
