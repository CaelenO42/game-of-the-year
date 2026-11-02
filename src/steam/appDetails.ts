import { querySteam } from "./client.js";
import type { SteamAppDetailsResponse,SteamAppDetails } from "./types.js";

export async function steamAppDetails(appid: number): Promise<SteamAppDetails | null> {
    const params = {
        appids: String(appid),
        cc: "us",
        l: "english"
    }

    const res = await querySteam<SteamAppDetailsResponse>("store", "/api/appdetails", params);
    const entry = res[appid];
    if (!entry?.success || !entry.data) return null;

    return entry.data;
}