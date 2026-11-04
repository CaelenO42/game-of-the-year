import { getTwitchGameId } from "../db/twitch.js";
import { queryTwitch } from "./client.js";
import type { TwitchStream, TwitchStreamsResponse } from "./types.js";

export async function twitchStreams(gameId: number, count: number = 20): Promise<TwitchStream[] | null> {
    const twitchGameId = await getTwitchGameId(gameId);
    if (!twitchGameId) return null;
    
    const params = {
        game_id: String(twitchGameId),
        first: String(count),
        language: "en"
    }

    const res = await queryTwitch<TwitchStreamsResponse>("streams", params);
    return res.data;
}