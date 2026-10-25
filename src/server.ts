import express from 'express';
import nunjucks from 'nunjucks';
import { searchIgdb } from './igdb/search.js';

const app = express();
const PORT = 3000;

nunjucks.configure('views', {
    autoescape: true,
    express: app
});
app.set("view engine", "njk");



app.get('/', async (req, res) => {
    let gameName: string = "portal";

    let data = await searchIgdb(gameName);
    
    let sorted = data.toSorted((a, b) => {
      const aExact = a.name.toLowerCase() === gameName.toLowerCase();
      const bExact = b.name.toLowerCase() === gameName.toLowerCase();

      if (aExact !== bExact) return aExact ? -1 : 1;

      return (b.total_rating_count ?? 0) - (a.total_rating_count ?? 0)
    });
    let game = sorted[0]
    console.log(game);  

    res.render('index', { game: game });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
