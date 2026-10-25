import { queryIgdb } from "./client.js"
import type { IgdbGenre } from "./types.js";

export async function genresIgdb() {
    const body = "fields id, name, slug; limit 500;";

    const data = await queryIgdb<IgdbGenre>("genres", body);

    return data;
};