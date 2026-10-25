import { requireEnv } from "../env.js";

const IGDB_CLIENT_ID = requireEnv("IGDB_CLIENT_ID");
const IGDB_TOKEN = requireEnv("IGDB_TOKEN");

export async function queryIgdb<T>(endpoint: string, body: string): Promise<T[]> {
    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: "POST",
        headers: {
            "Client-ID": IGDB_CLIENT_ID,
            "Authorization": `Bearer ${IGDB_TOKEN}`
        },
        body
    });

    if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${await res.text()}`);
    }

    const data: T[] = await res.json() as T[];
    return data;
}