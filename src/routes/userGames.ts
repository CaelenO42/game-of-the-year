import { Router, type Request, type Response } from "express"
import { getGame, type GameDetail } from "../db/games.js";
import { requireAuth } from "../middleware/auth.js";
import { validateRating, validateStatus } from "../validation/userGame.js";
import { getGameStats, getUserGame, setFavorite, setLibrary, setRating, setStatus } from "../db/userGames.js";
import { publish, subscribe } from "../realtime/live.js";

export const userGamesRouter = Router();

async function findGame(req: Request, res: Response): Promise<GameDetail | undefined> {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(404).render('404'); return undefined; }
    const game = await getGame(id);
    if (!game) { res.status(404).render('404'); return undefined; }
    return game;
}

userGamesRouter.get('/game/:id/stats', async (req, res) => {
    const game = await findGame(req, res);
    if (!game) return;

    const stats = await getGameStats(game.id);
    res.render('partials/game_stats', { game, stats });
})

userGamesRouter.get('/game/:id/events', async (req, res) => {
    const game = await findGame(req, res);
    if (!game) return;

    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
    res.flushHeaders()
    subscribe(game.id, res);
})

userGamesRouter.post('/game/:id/rating', requireAuth, async (req, res) => {
    if (!req.user) return res.status(401).end();

    const game = await findGame(req, res);
    if (!game) return;

    const rating = req.body?.rating;
    const parsed = validateRating(rating);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const userGame = await setRating(req.user.id, game.id, parsed.rating);
    publish(game.id, 'stats-changed');

    res.set('HX-Trigger', 'stats-changed');
    res.render('partials/user_game_controls', {game, userGame});
})

userGamesRouter.post('/game/:id/favorite', requireAuth, async (req, res) => {
    if (!req.user) return res.status(401).end();

    const game = await findGame(req, res);
    if (!game) return;

    const favorite = req.body?.favorite;
    if (favorite !== 'true' && favorite !== 'false') return res.status(400).json({ error: 'favorite must be a boolean'});
    const favBool = favorite === 'true';

    const userGame = await setFavorite(req.user.id, game.id, favBool);
    res.render('partials/user_game_controls', {game, userGame});
})

userGamesRouter.post('/game/:id/library', requireAuth, async (req, res) => {
    if (!req.user) return res.status(401).end();

    const game = await findGame(req, res);
    if (!game) return;

    const library = req.body?.library;
    if (library !== 'true' && library !== 'false') return res.status(400).json({ error: 'favorite must be a boolean'});
    const libBool = library === 'true';

    const userGame = await setLibrary(req.user.id, game.id, libBool);
    res.render('partials/user_game_controls', {game, userGame});
})

userGamesRouter.post('/game/:id/status', requireAuth, async (req, res) => {
    if (!req.user) return res.status(401).end();

    const game = await findGame(req, res);
    if (!game) return;

    const status = req.body?.status;
    const parsed = validateStatus(status);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const userGame = await setStatus(req.user.id, game.id, parsed.status);
    res.render('partials/user_game_controls', {game, userGame});
})

