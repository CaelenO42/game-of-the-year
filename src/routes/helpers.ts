import type { Request, Response } from "express";
import { getGame, type GameDetail } from "../db/games.js";

export async function findGame(req: Request, res: Response): Promise<GameDetail | undefined> {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(404).render('404'); return undefined; }
    const game = await getGame(id);
    if (!game) { res.status(404).render('404'); return undefined; }
    return game;
}

export async function findGameFromSlug(req: Request, res: Response): Promise<GameDetail | undefined> {
    const raw = req.params.idslug;
    const id = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (Number.isNaN(id)) { res.status(404).render('404'); return undefined; }
    const game = await getGame(id);
    if (!game) { res.status(404).render('404'); return undefined; }
    return game;
}