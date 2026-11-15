import { requireEnv } from "../lib/env.js";

const TWITCH_CLIENT_ID = requireEnv("TWITCH_CLIENT_ID");
const TWITCH_TOKEN = requireEnv("TWITCH_TOKEN");

export async function queryIgdb<T>(endpoint: string, body: string): Promise<T[]> {
    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: "POST",
        headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${TWITCH_TOKEN}`
        },
        body
    });

    if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${await res.text()}`);
    }

    const data: T[] = await res.json() as T[];
    return data;
}