import consola from "consola";
import { twitchStreams } from "../twitch/streams.js";
import type { TwitchData, TwitchStream } from "../twitch/types.js";

const MAX_CACHE_ENTRIES = 1000;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheEntry = { data: TwitchData; fetchedAt: number };
const cache = new Map<number, CacheEntry>();

export async function getTwitchData(gameId: number): Promise<TwitchData | null> {
    const entry = cache.get(gameId);
    if (entry && (Date.now() - entry.fetchedAt < TTL_MS)) return entry.data;

    try {
        const streams = await twitchStreams(gameId);
        const data = format(streams);
        updateCache(gameId, data);
        return data;
    } catch (err) {
        consola.error(`Error getting twitch data for GID ${gameId}:`, err);
        if (entry) return entry.data;
        return null;
    }
}

function format(streams: TwitchStream[] | null): TwitchData {
    const total_viewers = streams?.reduce((total, s) => total + s.viewer_count, 0) ?? 0;
    return { streams, total_viewers }
}

function updateCache(gameId: number, data: TwitchData) {
    cache.delete(gameId);
    if (cache.size >= MAX_CACHE_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(gameId, { data, fetchedAt: Date.now() });
}
