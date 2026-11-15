import type { Response } from "express";

const connections: Map<number, Set<Response>> = new Map();
export type LiveEvent = 'stats-changed';

export function subscribe(gameId: number, res: Response) {
    const set = connections.get(gameId) ?? new Set<Response>();
    set.add(res);
    connections.set(gameId, set);

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

    res.on('close', () => {
        clearInterval(heartbeat);
        const set = connections.get(gameId);
        if (!set) return;
        set.delete(res);
        if (set.size === 0) connections.delete(gameId);
    })
}

export function publish(gameId: number, event: LiveEvent) {
    const set = connections.get(gameId);
    if (!set) return;

    set.forEach((conn) => { conn.write(`event:${event}\ndata:{}\n\n`) });
}