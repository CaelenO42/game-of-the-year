import type { Response } from "express";

const connections: Map<string, Set<Response>> = new Map();
export type LiveEvent = 'stats-changed' | 'reviews-changed';
export type Channel = `game:${number}` | `review:${number}`;

export function subscribe(channel: Channel, res: Response) {
    const set = connections.get(channel) ?? new Set<Response>();
    set.add(res);
    connections.set(channel, set);

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

    res.on('close', () => {
        clearInterval(heartbeat);
        const set = connections.get(channel);
        if (!set) return;
        set.delete(res);
        if (set.size === 0) connections.delete(channel);
    })
}

export function publish(channel: Channel, event: LiveEvent) {
    const set = connections.get(channel);
    if (!set) return;

    set.forEach((conn) => { conn.write(`event:${event}\ndata:{}\n\n`) });
}