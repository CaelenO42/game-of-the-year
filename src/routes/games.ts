import { Router } from "express";
import { getGame } from "../db/games.js";
import { getSteamData } from "../services/steamData.js";
import { slugify } from "../lib/slug.js";
import consola from "consola";
import { getTwitchData } from "../services/twitchData.js";
import { PAGE_SIZE, searchWithFallback } from "../services/gameSearch.js";
import { getGameStats, getUserGame } from "../db/userGames.js";
import { normalizePage } from "../lib/page.js";
import { findGameFromSlug } from "./helpers.js";

export const gamesRouter = Router();

const MAX_PAGE = 500;

gamesRouter.get('/game/:idslug', async (req, res) => {
    const game = await findGameFromSlug(req, res);
    if (!game) return;

    const path = `/game/${game.id}-${slugify(game.name)}`;
    if (req.path !== path) return res.redirect(301, path);

    const [steam, twitch, stats, userGame] = await Promise.all([
        getSteamData(game.id).catch((err) => {
            consola.error(`Steam data failed for game ${game.id}:`, err);
            return null;
        }),
        getTwitchData(game.id),
        getGameStats(game.id),
        (req.user) ? getUserGame(req.user.id, game.id) : undefined
    ])

    return res.render('game', { game, steam, twitch, stats, userGame, host: req.hostname });
});

gamesRouter.get('/search', async (req, res) => {
    const query = req.query.q;
    const page = normalizePage(req.query.page, MAX_PAGE);
    if (typeof query !== 'string' || query.length === 0) return res.redirect('/');
    
    const { results, total } = await searchWithFallback(query, page);
    if (results.length === 0 && page > 1) return res.redirect(`/search?q=${encodeURIComponent(query)}`);
    return res.render('search', { 
        results, total, page, query, 
        totalPages: Math.ceil(total / PAGE_SIZE)
    });
});