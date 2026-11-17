import type { GameDetail } from "../db/games.js";
import type { GameStats, UserGameRow } from "../db/userGames.js";
import type { UserRow } from "../db/users.js";
import type { Role } from "../validation/roles.js";
import type { Status } from "../validation/userGame.js";

export function idToCover(id: string) {
    return `https://images.igdb.com/igdb/image/upload/t_cover_big/${id}.jpg`;
}

export type ApiUser = {
    id: number;
    username: string | null;
    displayName: string | null;
    role: Role;
    createdAt: string;
};

export function toApiUser(user: UserRow): ApiUser {
    return {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        createdAt: user.created_at.toISOString()
    }
}

export type ApiGame = {
    id: number;
    name: string;
    summary: string | null;
    releaseDate: string | null;
    coverUrl: string | null;
    genres: { name: string, slug: string }[];
    platforms: { name: string, slug: string, abbreviation: string | null }[];
}

export function toApiGame(game: GameDetail): ApiGame {
    return {
        id: game.id,
        name: game.name,
        summary: game.summary,
        releaseDate: game.first_release_date?.toISOString().slice(0, 10) ?? null,
        coverUrl: game.cover_image_id ? idToCover(game.cover_image_id) : null,
        genres: game.genres,
        platforms: game.platforms
    }
}

export type ApiGameStats = {
    id: number;
    name: string;
} & GameStats

export function toApiGameStats(game: GameDetail, stats: GameStats): ApiGameStats {
    return {
        id: game.id,
        name: game.name,
        count: stats.count,
        average: stats.average
    }
}

export type ApiUserRating = {
    gameId: number;
    rating: number | null;
};

export function toApiUserRating(gameId: number, rating: number): ApiUserRating {
    return { gameId, rating }
}