import { genresIgdb } from "../igdb/genre.js";
import { platformsIgdb } from "../igdb/platforms.js";
import { pool } from "./pool.js";

const client = await pool.connect();
try {
    // Get Data
    const genreData = await genresIgdb();
    const platformData = await platformsIgdb();

    // Begin Query
    await client.query("BEGIN");

    // Genre Loop
    for (const genre of genreData) {
        await client.query(`
            INSERT INTO genre (igdb_id, name, slug)
            VALUES ($1, $2, $3)
            ON CONFLICT (igdb_id) DO UPDATE
            SET name = EXCLUDED.name, slug = EXCLUDED.slug;
        `, [genre.id, genre.name, genre.slug]);
    }

    // Platform Loop
    for (const platform of platformData) {
        await client.query(`
            INSERT INTO platform (igdb_id, name, abbreviation, summary, slug, logo_image_id, platform_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (igdb_id) DO UPDATE
            SET name = EXCLUDED.name,
                abbreviation = EXCLUDED.abbreviation,
                summary = EXCLUDED.summary,
                slug = EXCLUDED.slug,
                logo_image_id = EXCLUDED.logo_image_id,
                platform_type = EXCLUDED.platform_type;
        `, [
            platform.id, 
            platform.name, 
            platform.abbreviation ?? null,
            platform.summary ?? null, 
            platform.slug, 
            platform.platform_logo?.image_id ?? null,
            platform.platform_type?.name ?? null
        ]);
    }

    // Commit
    await client.query("COMMIT");
} catch (err) {
    await client.query("ROLLBACK");
    throw err;
} finally {
    client.release();
    await pool.end();
}