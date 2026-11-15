import { listReviewsForGame, type UserReviewDetail } from "../db/userReviews.js";

const REVIEW_PREVIEW_SIZE = 10;

export async function fetchLatestReviews(gameId: number): Promise<{ reviews: UserReviewDetail[], total: number }> {
    return await listReviewsForGame(gameId, REVIEW_PREVIEW_SIZE, 1);
}