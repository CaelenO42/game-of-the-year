import type { NextFunction, Request, Response } from 'express';
import { getSessionUser, touchSession } from '../db/sessions.js';

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (req.user) return next();
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

export function setCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(SESSION_COOKIE_NAME, token, { ...COOKIE_OPTIONS, expires: expiresAt });
}

export function getCookie(req: Request): string | undefined {
    return req.cookies[SESSION_COOKIE_NAME];
}

export function clearCookie(res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
}