import { Router } from "express"
import { getGame } from "../db/games.js";
import { requireAuth } from "../middleware/auth.js";
import { validateRating } from "../userGame.js";
import { getGameStats, getUserGame, setRating } from "../db/userGames.js";
import { publish, subscribe } from "../live.js";

export const userGamesRouter = Router();

userGamesRouter.get('/game/:id/stats', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).render('404');
    const game = await getGame(id);
    if (!game) return res.status(404).render('404');

    const stats = await getGameStats(game.id);
    res.render('partials/game_stats', { game, stats });
})

userGamesRouter.get('/game/:id/events', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).render('404');
    const game = await getGame(id);
    if (!game) return res.status(404).render('404');

    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
    res.flushHeaders()
    subscribe(game.id, res);
})

userGamesRouter.post('/game/:id/rating', requireAuth, async (req, res) => {
    if (!req.user) return res.status(401).end();

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).render('404');
    const game = await getGame(id);
    if (!game) return res.status(404).render('404');

    const rating = req.body?.rating;
    const parsed = validateRating(rating);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const userGame = await setRating(req.user.id, id, parsed.rating);
    publish(game.id, 'stats-changed');

    res.set('HX-Trigger', 'stats-changed');
    res.render('partials/user_game_controls', {game, userGame});
})