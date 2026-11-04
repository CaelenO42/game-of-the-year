export type TwitchStreamsResponse = {
    data: TwitchStream[],
    pagination: { cursor: string }
}

export type TwitchStream = {
    id: string,
    user_id: string,
    user_login: string,
    user_name: string,
    game_name: string,
    title: string,
    viewer_count: number,
    language: string,
    thumbnail_url: string,
    tags: string[]
}

export type TwitchData = {
    streams: TwitchStream[] | null
    total_viewers: number
}