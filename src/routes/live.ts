import { Router } from "express";
import { findGame } from "./helpers.js";
import { subscribe } from "../realtime/live.js";

export const liveRouter = Router();

// Game Page Live Events
liveRouter.get('/game/:id/events', async (req, res) => {
    const game = await findGame(req, res);
    if (!game) return;

    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
    res.flushHeaders()
    subscribe(`game:${game.id}`, res);
})