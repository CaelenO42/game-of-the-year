import { querySteam } from "./client.js";
import type { SteamUserReviewsResponse, SteamUserReviewsSummary } from "./types.js";

export async function steamReviewSummary(appid: number): Promise<SteamUserReviewsSummary> {
    const input = { appid: appid, num_per_page: 1, languages: ["all"] };

    const data = await querySteam<SteamUserReviewsResponse>(
        "api",
        "IUserReviewsService/GetAppReviews/v1",
        { input_json: JSON.stringify(input) }
    );
    return data.response.query_summary;
}