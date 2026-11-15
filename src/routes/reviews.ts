import { Router } from "express";
import { findGame, findGameFromSlug } from "./helpers.js";
import { normalizePage } from "../lib/page.js";
import { deleteReview, listReviewsForGame, setReview } from "../db/userReviews.js";
import { getGameStats } from "../db/userGames.js";
import { fetchLatestReviews } from "../services/reviews.js";
import { validateReviewBody } from "../validation/review.js";
import { slugify } from "../lib/slug.js";
import { requireAuth } from "../middleware/auth.js";
import { publish } from "../realtime/live.js";

export const reviewsRouter = Router();

const PAGE_SIZE = 25;
const MAX_PAGE = 500;

reviewsRouter.get('/game/:idslug/reviews', async (req, res) => {
    const page = normalizePage(req.query.p, MAX_PAGE);

    const game = await findGameFromSlug(req, res);
    if (!game) return;

    const path = `/game/${game.id}-${slugify(game.name)}/reviews`;
    if (req.path !== path) return res.redirect(301, path + '?p=' + page);

    const [{ reviews, total }, stats] = await Promise.all([
        listReviewsForGame(game.id, PAGE_SIZE, page),
        getGameStats(game.id)
    ]);

    if (reviews.length === 0 && page > 1) return res.redirect(`/game/${req.params.idslug}/reviews?p=1`);

    return res.render('game_reviews', { game, reviews, stats, page, totalPages: Math.ceil(total / PAGE_SIZE) })
})

reviewsRouter.get('/game/:id/reviews/latest', async (req, res) => {
    const game = await findGame(req, res);
    if (!game) return;

    const { reviews, total } = await fetchLatestReviews(game.id);

    return res.render('partials/review_list', { game, reviews, totalReviews: total })
})

reviewsRouter.post('/game/:id/review', requireAuth, async (req, res) => {
    if (!req.user) return res.status(401).end();

    const game = await findGame(req, res);
    if (!game) return;
    const validate = validateReviewBody(req.body.text, req.body.contains_spoilers);
    if (!validate.ok) return res.status(400).json({ error: validate.error });

    const review = await setReview(req.user.id, game.id, validate.review, validate.spoilers);

    // publish(game.id, 'reviews-changed');
    res.set('HX-Trigger', 'reviews-changed');
    res.render('partials/review_form', { game, userReview: review });
})

reviewsRouter.delete('/game/:id/review', requireAuth, async (req, res) => {
    if (!req.user) return res.status(401).end();

    const game = await findGame(req, res);
    if (!game) return;

    await deleteReview(req.user.id, game.id);

    // publish(game.id, 'reviews-changed');
    res.set('HX-Trigger', 'reviews-changed');
    res.render('partials/review_form', { game });
})

