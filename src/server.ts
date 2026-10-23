import express from 'express';
import nunjucks from 'nunjucks';
import type { IgdbGame } from './igdb/types.js';
const app = express();
const PORT = 3000;

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_TOKEN = process.env.IGDB_TOKEN;

nunjucks.configure('views', {
    autoescape: true,
    express: app
});
app.set("view engine", "njk");


async function searchIGDB(game: string): Promise<IgdbGame[]> {
    const res = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
            "Client-ID": IGDB_CLIENT_ID,
            "Authorization": `Bearer ${IGDB_TOKEN}`
        },
        body: `search "${game}"; fields id, cover.image_id, age_ratings.rating_category.rating, age_ratings.organization.name, aggregated_rating, aggregated_rating_count, first_release_date, franchises.name, franchises.slug, game_engines.description, game_engines.name, game_engines.slug, game_engines.id, genres.name, involved_companies.company.name, involved_companies.developer, involved_companies.porting, involved_companies.publisher, involved_companies.supporting, name, platforms.abbreviation, platforms.name, platforms.platform_logo.image_id, platforms.platform_type.name, release_dates.date, release_dates.date_format, release_dates.platform, release_dates.release_region.region, similar_games.name, similar_games.cover.image_id, summary, updated_at, websites.url, websites.trusted, websites.type.type, external_games.uid, external_games.external_game_source.name, total_rating_count; where game_type = (0, 8, 9); limit 20;`,
    });

    if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${await res.text()}`);
    }

    const data: IgdbGame[] = await res.json() as IgdbGame[];
    return data;
}

app.get('/', async (req, res) => {
    let gameName: string = "portal";

    let data = await searchIGDB(gameName);
    
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
