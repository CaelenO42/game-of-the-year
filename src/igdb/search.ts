import { queryIgdb } from "./client.js"
import type { IgdbGame } from "./types.js"

const GAME_FIELDS = [
    "id",
    "name",
    "summary",
    "updated_at",
    "cover.image_id",

    // ratings
    "age_ratings.rating_category.rating",
    "age_ratings.organization.name",
    "aggregated_rating",
    "aggregated_rating_count",
    "total_rating_count",

    // release
    "first_release_date",
    "release_dates.date",
    "release_dates.date_format",
    "release_dates.platform",
    "release_dates.release_region.region",

    // franchises and engines
    "franchises.name",
    "franchises.slug",
    "game_engines.description",
    "game_engines.name",
    "game_engines.slug",
    "game_engines.id",

    // genres and platforms
    "genres.id",
    "platforms.id",
    // "platforms.abbreviation",
    // "platforms.name",
    // "platforms.platform_logo.image_id",
    // "platforms.platform_type.name",

    // companies
    "involved_companies.company.name",
    "involved_companies.developer",
    "involved_companies.porting",
    "involved_companies.publisher",
    "involved_companies.supporting",

    // related and external
    "similar_games.name",
    "similar_games.cover.image_id",
    "websites.url",
    "websites.trusted",
    "websites.type.type",
    "external_games.uid",
    "external_games.external_game_source.name",
];

export async function searchIgdb(game: string) {
    const body: string = `search "${game}"; fields ${GAME_FIELDS.join(", ")}; where game_type = (0, 8, 9); limit 20;`

    return await queryIgdb<IgdbGame>("games", body);
}
