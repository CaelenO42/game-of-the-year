export type SteamAppDetailsResponse = Record<string, {
    success: boolean
    data?: SteamAppDetails
}>

export type SteamAppDetails = {
    is_free: boolean,
    controller_support?: string,
    about_the_game?: string,
    reviews?: string,
    pc_requirements?: {
        minimum?: string,
        recommended?: string
    },
    metacritic?: {
        score: number,
        url: string
    },
    categories?: { id: number, description: string }[],
    achievements?: {
        total: number,
        highlighted?: {
            icon: string,
            localized_name: string,
            archived: number,
            hidden: number,
        }[]
    }
}

export type SteamUserReviewsResponse = {
    response: {
        query_summary: SteamUserReviewsSummary,
        reviews: []
    }
}

export type SteamUserReviewsSummary = {
    total_positive: number,
    total_negative: number,
    total_reviews: number,
    review_score_desc?: string
}