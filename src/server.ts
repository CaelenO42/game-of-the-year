import express from 'express';
import nunjucks from 'nunjucks';
import { searchIgdb } from './igdb/search.js';
import { getGame } from './db/games.js';
import { slugify } from './slug.js';

const app = express();
const PORT = 3000;

nunjucks.configure('views', {
    autoescape: true,
    express: app
});
app.set("view engine", "njk");



app.get('/', (req, res) => {
    res.render('home');
});

app.get('/game/:idslug', async (req, res) => {
    const id = parseInt(req.params.idslug);
    if (Number.isNaN(id)) return res.status(404);

    const game = await getGame(id);
    if (!game) return res.status(404);

    const path = `/game/${game.id}-${slugify(game.name)}`;
    if (req.path !== path) return res.redirect(301, path);

    return res.render('game', { game });
})

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
