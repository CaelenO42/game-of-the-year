import type { Request, Response } from "express";
import { getGame, type GameDetail } from "../db/games.js";
import { getUserByUsername, type UserRow } from "../db/users.js";

export async function findGame(req: Request, res: Response): Promise<GameDetail | undefined> {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(404).render('errors/404'); return undefined; }
    const game = await getGame(id);
    if (!game) { res.status(404).render('errors/404'); return undefined; }
    return game;
}

export async function findGameJson(req: Request, res: Response): Promise<GameDetail | undefined> {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: 'Invalid game id' }); return undefined; }
    const game = await getGame(id);
    if (!game) { res.status(404).json({ error: 'Game not found' }); return undefined; }
    return game;
}

export async function findGameFromSlug(req: Request, res: Response): Promise<GameDetail | undefined> {
    const raw = req.params.idslug;
    const id = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (Number.isNaN(id)) { res.status(404).render('errors/404'); return undefined; }
    const game = await getGame(id);
    if (!game) { res.status(404).render('errors/404'); return undefined; }
    return game;
}

export async function findUser(req: Request, res: Response): Promise<UserRow | undefined> {
    const raw = req.params.username;
    if (typeof raw !== 'string') { res.status(400).render('errors/400'); return undefined; }
    const profile = await getUserByUsername(raw);
    if (!profile) { res.status(404).render('errors/404'); return undefined; }
    return profile;
}