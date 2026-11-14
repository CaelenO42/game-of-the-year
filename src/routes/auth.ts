import { Router, type Response } from "express";
import { safeNext } from "../redirect.js";
import { USERNAME_MAX, USERNAME_MIN, validateUsername } from "../username.js";
import { clearCookie, getCookie, requireAuth, setCookie } from "../middleware/auth.js";
import { setUsername, upsertUser } from "../db/users.js";
import { adminAuth } from "../firebase/admin.js";
import consola from "consola";
import { createSession, deleteSession } from "../db/sessions.js";
import { sessionMetaFromRequest } from "../sessionMeta.js";

export const authRouter = Router();
const TOKEN_AGE = 5 * 60; // 5 Minutes (sec)

// Auth Routes
authRouter.get('/login', (req, res) => {
    if (req.user) return res.redirect(safeNext(req.query.next));
    res.render('login', { next: safeNext(req.query.next) });
})

authRouter.get('/signup', (req, res) => {
    if (req.user) return res.redirect(safeNext(req.query.next));
    res.render('signup', { next: safeNext(req.query.next) });
})

function renderOnboarding(res: Response, status: number, next: string, error?: string, username?: string) {
    return res.status(status).render('onboarding', { 
        error, 
        next: safeNext(next),
        usernameMin: USERNAME_MIN,
        usernameMax: USERNAME_MAX,
        username
     });
}

authRouter.get('/onboarding', requireAuth, (req, res) => {
    if (req.user?.username) return res.redirect(safeNext(req.query.next));
    return renderOnboarding(res, 200, safeNext(req.query.next));
})

authRouter.post('/onboarding', requireAuth, async (req, res) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.username) return res.redirect(safeNext(req.body?.next));

    const next = safeNext(req.body?.next);
    const result = validateUsername(req.body?.username);
    if (!result.ok) return renderOnboarding(res, 400, next, result.error, result.username);

    const setResult = await setUsername(req.user.id, result.username);
    if (setResult.ok) return res.redirect(next);

    switch (setResult.reason) {
        case 'taken':    return renderOnboarding(res, 409, next, 'That username is taken.', result.username);
        case 'reserved': return renderOnboarding(res, 409, next, 'That username was recently used and is currently unavailable.', result.username);
        case 'cooldown': return renderOnboarding(res, 429, next, `You can change your username again on ${setResult.availableAt.toLocaleDateString()}.`, result.username);
        case 'no_user':  return res.redirect('/login');
        default:         return renderOnboarding(res, 400, next, 'Invalid username.', result.username);
    }
})

authRouter.post('/auth/session', async (req, res) => {
    const idToken = req.body?.idToken;
    if (typeof idToken !== "string") return res.status(400).json({ error: "Missing idToken" });

    const oldCookie = getCookie(req);
    if (oldCookie) await deleteSession(oldCookie);

    let uid: string;
    try {
        const token = await adminAuth.verifyIdToken(idToken);

        const currentTime = Date.now() / 1000;
        if (currentTime - token.auth_time > TOKEN_AGE) return res.status(401).json({ error: "Recent sign-in required" });

        uid = token.uid;
    } catch (err) {
        consola.error(err);
        return res.status(401).json({ error: "Invalid token" });
    }

    try {
        const user = await upsertUser(uid);
        if (user.banned_at) return res.status(403).json({ error: "This account has been suspended." });
        const session = await createSession(user.id, sessionMetaFromRequest(req));

        setCookie(res, session.token, session.expiresAt);

        const next = safeNext(req.body?.next);
        return res.json({
            redirect: user.username === null ? `/onboarding?next=${encodeURIComponent(next)}` : next
        });
    } catch (err) {
        consola.error(err);
        return res.status(500).json({ error: "Could not load account" });
    }
});

authRouter.post('/auth/logout', async (req, res) => {
    const token = getCookie(req);
    if (token) await deleteSession(token);
    clearCookie(res);

    return res.redirect('/');
});