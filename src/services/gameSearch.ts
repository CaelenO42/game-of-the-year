import { saveGame, searchGames, type GameSearchPage } from "../db/games.js";
import { searchIgdb } from "../igdb/search.js";

export const PAGE_SIZE = 20;

const MAX_CACHE_ENTRIES = 1000;
const TTL_MS = 60 * 60 * 1000; // 1 hour
const recentQueries = new Map<string, number>();

export async function searchWithFallback(query: string, page: number):Promise<GameSearchPage> {
    page = Math.max(1, Math.floor(page));
    const pageOffset = (page - 1) * PAGE_SIZE;
    query = query.trim().slice(0, 99);
    if (query.length === 0) return { results: [], total: 0 };

    const dbSearch = await searchGames(query, pageOffset, PAGE_SIZE);

    if (dbSearch.total >= 10 || page > 1) return dbSearch;
    const qk = query.toLowerCase();
    const lastChecked = recentQueries.get(qk);
    if (lastChecked && (Date.now() - lastChecked) < TTL_MS) return dbSearch;

    try {
        const igdbSearch = await searchIgdb(query);
        if (igdbSearch.length === 0) {
            updateCache(qk);
            return dbSearch;
        }

        await Promise.all(igdbSearch.map(game => saveGame(game)));
    } catch (err) {
        console.error("Search returned an error:", err);
        return dbSearch;
    }

    updateCache(qk);
    return searchGames(query, pageOffset, PAGE_SIZE);
}

function updateCache(qk: string) {
    recentQueries.delete(qk);
    if (recentQueries.size >= MAX_CACHE_ENTRIES) recentQueries.delete(recentQueries.keys().next().value ?? "");
    recentQueries.set(qk, Date.now());
}