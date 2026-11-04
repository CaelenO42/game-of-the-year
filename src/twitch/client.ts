import { requireEnv } from "../env.js";

const TWITCH_CLIENT_ID = requireEnv("TWITCH_CLIENT_ID");
const TWITCH_TOKEN = requireEnv("TWITCH_TOKEN");

export async function queryTwitch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(endpoint, "https://api.twitch.tv/helix/");

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }

    const res = await fetch(url, {
        method: "GET",
        headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${TWITCH_TOKEN}`
        },
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${await res.text()}`);

    return await res.json() as T;
}