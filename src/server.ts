import express from 'express';
import nunjucks from 'nunjucks';
import { getGame } from './db/games.js';
import { slugify } from './slug.js';
import { PAGE_SIZE, searchWithFallback } from './services/gameSearch.js';
import { getSteamData } from './services/steamData.js';
import { getTwitchData } from './services/twitchData.js';
import { checkDb } from './db/pool.js';
import consola from 'consola';
import { adminAuth } from './firebase/admin.js';
import { upsertUser } from './db/users.js';

const app = express();
const PORT = 3000;

const MAX_PAGE = 500;

await checkDb();

app.use(express.json());
app.use(express.static("public"))
nunjucks.configure('views', {
    autoescape: true,
    express: app,
    noCache: process.env.NODE_ENV !== 'production'
});
app.set("view engine", "njk");



app.get('/', (req, res) => {
    res.render('home');
});

app.get('/game/:idslug', async (req, res) => {
    const id = parseInt(req.params.idslug);
    if (Number.isNaN(id)) return res.status(404).render('404');

    const game = await getGame(id);
    if (!game) return res.status(404).render('404');

    const path = `/game/${game.id}-${slugify(game.name)}`;
    if (req.path !== path) return res.redirect(301, path);

    const [steam, twitch] = await Promise.all([
        getSteamData(game.id).catch((err) => {
            consola.error(`Steam data failed for game ${game.id}:`, err);
            return null;
        }),
        getTwitchData(game.id)
    ])

    return res.render('game', { game, steam, twitch });
})

app.get('/search', async (req, res) => {
    const query = req.query.q;
    const page = normalizePage(req.query.page);
    if (typeof query !== 'string' || query.length === 0) return res.redirect('/');
    
    const { results, total } = await searchWithFallback(query, page);
    if (results.length === 0 && page > 1) return res.redirect(`/search?q=${encodeURIComponent(query)}`);
    return res.render('search', { 
        results, total, page, query, 
        totalPages: Math.ceil(total / PAGE_SIZE)
    });
})

// Auth Rotes
const TOKEN_AGE = 5 * 60; // 5 Minutes (sec)
const SESSION_EXPIRATION = 14 * 24 * 60 * 60 * 1000; // 14 days (ms)
const SESSION_COOKIE_NAME = "session";

// Auth Routes
app.get('/login', (req, res) => {
    res.render('login');
})

app.get('/signup', (req, res) => {
    res.render('signup');
})

app.post('/auth/session', async (req, res) => {
    const idToken = req.body?.idToken;
    if (typeof idToken !== "string") return res.status(400).json({ error: "Missing idToken" });

    let uid: string;
    let session: string;
    try {
        const token = await adminAuth.verifyIdToken(idToken);

        const currentTime = Date.now() / 1000;
        if (currentTime - token.auth_time > TOKEN_AGE) return res.status(401).json({ error: "Recent sign-in required" });

        uid = token.uid;
        session = await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRATION });
    } catch (err) {
        consola.error(err);
        return res.status(401).json({ error: "Invalid token" });
    }

    try {
        const user = await upsertUser(uid);

        res.cookie("session", session, { 
            maxAge: SESSION_EXPIRATION, 
            httpOnly: true, 
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        });
        return res.json({ redirect: user.username === null ? "/onboarding" : "/" });
    } catch (err) {
        consola.error(err);
        return res.status(500).json({ error: "Could not load account" });
    }
});

app.listen(PORT, () => {
    consola.info(`Server running at http://localhost:${PORT}/`);
});

function normalizePage(value: unknown): number {
    const page = Math.floor(Number(value));
    if (!Number.isFinite(page)) return 1;
    return Math.min(Math.max(page, 1), MAX_PAGE);
}