import type { NextFunction, Request, Response } from 'express';
import { getSessionUser, touchSession } from '../db/sessions.js';
import type { Role } from '../validation/roles.js';

const SESSION_COOKIE_NAME = "session";
const ONBOARDING_ALLOWED = ["/onboarding", "/auth"];
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
} as const;

export async function loadUser(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (typeof token !== 'string') return next();

    const sessionUser = await getSessionUser(token);
    if (!sessionUser) {
        clearCookie(res);
        return next();
    }

    req.user = sessionUser.user;
    res.locals.user = req.user;

    const newExpiry = await touchSession(sessionUser.sessionId);
    if (newExpiry) setCookie(res, token, newExpiry);

    next();
}

function currentPageFromHtmx(req: Request): string | undefined {
    const header = req.get("HX-Current-URL");
    if (!header) return undefined;
    try {
        const url = new URL(header);
        return url.pathname + url.search;
    } catch {
        return undefined;
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (req.user) return next();

    // make sure htmx reqests dont embed login page
    if (req.get("HX-Request") === "true") {
        const page = currentPageFromHtmx(req);
        const target = page ? `/login?next=${encodeURIComponent(page)}` : "/login";
        return res.set("HX-Redirect", target).status(401).end();
    }

    if (req.method !== "GET") return res.redirect("/login");
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
}

export function enforceOnboarding(req: Request, res: Response, next: NextFunction) {
    if (!req.user || req.user.username) return next();

    const allowed = ONBOARDING_ALLOWED.some((p) => req.path === p || req.path.startsWith(`${p}/`));
    if (allowed) return next();

    if (req.method !== "GET") return res.status(403).json({ error: "Choose a username first" });
    return res.redirect(`/onboarding?next=${encodeURIComponent(req.originalUrl)}`);
}

export function requireRole(role: Role) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || req.user.role !== role) {
            if (req.get("HX-Request") === "true") return res.status(403).end();
            return res.status(403).render('errors/403');
        }
        return next();
    };
}

export function setCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(SESSION_COOKIE_NAME, token, { ...COOKIE_OPTIONS, expires: expiresAt });
}

export function getCookie(req: Request): string | undefined {
    return req.cookies[SESSION_COOKIE_NAME];
}

export function clearCookie(res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
}