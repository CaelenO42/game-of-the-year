import { getSteamAppId, getSteamRow, saveSteamDetails, saveSteamReviews, type SteamRow } from "../db/steam.js";
import { steamAppDetails } from "../steam/appDetails.js";
import { steamReviewSummary } from "../steam/userReviews.js";

const TTL_MS = 24 * 60 * 60 * 1000; // 1 day

export async function getSteamData(gameId: number): Promise<SteamRow | null> {
    const row = await getSteamRow(gameId);

    const steamAppId = row?.steam_app_id ?? await getSteamAppId(gameId);
    if (!steamAppId) return null;

    const detailsStale = !row?.fetched_at || Date.now() - row.fetched_at.getTime() > TTL_MS;
    const reviewsStale = !row?.reviews_fetched_at || Date.now() - row.reviews_fetched_at.getTime() > TTL_MS;

    const [detailsResult, reviewsResult] = await Promise.allSettled([
        detailsStale ? refreshDetails(gameId, steamAppId) : undefined,
        reviewsStale ? refreshReviews(gameId, steamAppId) : undefined,
    ]);

    logFailure("details", gameId, steamAppId, detailsResult);
    logFailure("reviews", gameId, steamAppId, reviewsResult);

    return (await getSteamRow(gameId) ?? null);
}

async function refreshDetails(gameId: number, steamAppId: number) {
    const details = await steamAppDetails(steamAppId);
    await saveSteamDetails(gameId, steamAppId, details);
}

async function refreshReviews(gameId: number, steamAppId: number) {
    const summary = await steamReviewSummary(steamAppId);
    await saveSteamReviews(gameId, steamAppId, summary);
}

function logFailure(what: string, gameId: number, steamAppId: number, result: PromiseSettledResult<unknown>) {
    if (result.status === "rejected") {
        console.error(`Steam ${what} failed for game ${gameId} (Steam ID ${steamAppId}):`, result.reason);
    }
}
