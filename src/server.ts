import express from 'express';
import nunjucks from 'nunjucks';
const app = express();
const PORT = 3000;

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_TOKEN = process.env.IGDB_TOKEN;

nunjucks.configure('views', {
    autoescape: true,
    express: app
});
app.set("view engine", "njk");


async function searchIGDB(game: String) {
    console.log(IGDB_CLIENT_ID);

    const res = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
            "Client-ID": IGDB_CLIENT_ID,
            "Authorization": `Bearer ${IGDB_TOKEN}`
        },
        body: `search "${game}"; fields *; where game_type = (0, 8, 9);`,
    });

    if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return data;
}

app.get('/', async (req, res) => {
    let data = await searchIGDB("portal");
    let game = data[0];
    console.log(game);  

    res.render('index', { game: game });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
