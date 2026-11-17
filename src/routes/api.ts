import express, { Router, type Request, type Response, type NextFunction } from "express";
import { requireApiKey } from "../middleware/apiAuth.js";
import consola from "consola";
import { findGameJson } from "./helpers.js";
import { toApiGame, toApiGameStats, toApiUser, toApiUserRating } from "../api/serializers.js";
import { getGameStats, getUserGame, setRating } from "../db/userGames.js";
import { validateRating } from "../validation/userGame.js";
import { publish } from "../realtime/live.js";

export const apiV1Router = Router();
apiV1Router.use(requireApiKey);
apiV1Router.use(express.json());

// Key User Info
apiV1Router.get('/me', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'You do not have permission to do this' });
    const user = req.user;

    res.json(toApiUser(user));
})

// Game Info
apiV1Router.get('/games/:id', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'You do not have permission to do this' });

    const game = await findGameJson(req, res);
    if (!game) return;
    return res.json(toApiGame(game));
})

apiV1Router.get('/games/:id/stats', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'You do not have permission to do this' });

    const game = await findGameJson(req, res);
    if (!game) return;
    const stats = await getGameStats(game.id);
    return res.json(toApiGameStats(game, stats));
})

// User Game Rating
apiV1Router.get('/games/:id/rating', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'You do not have permission to do this' });

    const game = await findGameJson(req, res);
    if (!game) return;
    const userGame = await getUserGame(req.user.id, game.id);
    if (!userGame || userGame.rating === null) return res.status(404).json({ error: 'You have no rating for this game' });
    return res.json(toApiUserRating(game.id, userGame.rating)); 
});

apiV1Router.put('/games/:id/rating', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'You do not have permission to do this' });

    const game = await findGameJson(req, res);
    if (!game) return;

    const validate = validateRating(req.body?.rating);
    if (!validate.ok) return res.status(400).json({ error: validate.error });
    if (validate.rating === null) return res.status(400).json({ error: 'Rating is required. Use DELETE to remove a rating.' });

    await setRating(req.user.id, game.id, validate.rating);
    publish(`game:${game.id}`, 'stats-changed');
    return res.json(toApiUserRating(game.id, validate.rating)); 
})

apiV1Router.delete('/games/:id/rating', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'You do not have permission to do this' });

    const game = await findGameJson(req, res);
    if (!game) return;
    await setRating(req.user.id, game.id, null);
    publish(`game:${game.id}`, 'stats-changed');
    return res.status(204).end();
})


// Error Handling
apiV1Router.use((req, res) => res.status(404).json({ error: 'Not found' }))
apiV1Router.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const status = (typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number')
    ? err.status
    : 500;

    if (status >= 400 && status < 500) return res.status(status).json({ error: 'Invalid request body' });

    consola.error(err);
    res.status(500).json({ error: 'Internal server error' });
})