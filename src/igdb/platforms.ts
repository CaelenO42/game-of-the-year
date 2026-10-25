import { queryIgdb } from "./client.js"
import type { IgdbPlatform } from "./types.js";

export async function platformsIgdb() {
    const body = "fields id, abbreviation, name, slug, summary, platform_logo.image_id, platform_type.name; limit 500;";

    const data = await queryIgdb<IgdbPlatform>("platforms", body);

    return data;
};