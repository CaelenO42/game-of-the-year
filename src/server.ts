import express from 'express';
import nunjucks from 'nunjucks';
import { getGame } from './db/games.js';
import { slugify } from './slug.js';
import { PAGE_SIZE, searchWithFallback } from './services/gameSearch.js';

const app = express();
const PORT = 3000;

const MAX_PAGE = 500;

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

    return res.render('game', { game });
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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});

function normalizePage(value: unknown): number {
    const page = Math.floor(Number(value));
    if (!Number.isFinite(page)) return 1;
    return Math.min(Math.max(page, 1), MAX_PAGE);
}