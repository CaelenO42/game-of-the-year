import type { Request } from "express";
import Bowser from "bowser";

export type SessionMeta = {
    userAgent: string | null,
    os: string | null,
    client: string | null,
    location: string | null,
};

export function sessionMetaFromRequest(req: Request): SessionMeta {
    const userAgent = req.get('user-agent')?.slice(0, 512) ?? null;

    const uaParse = parseUserAgent(userAgent);
    // parse location from ip
    return { userAgent, os: uaParse.os, client: uaParse.client, location: null };
}

function parseUserAgent(ua: string | null): { os: string | null, client: string | null } {
    if (!ua) return { os: null, client: null };
    const { os, browser } = Bowser.parse(ua);
    return {
        os: os.name ?? null,
        client: browser.name ? `${browser.name} ${browser.version?.split('.')[0] ?? ''}`.trim() : null,
    };
}

function locationFromIP(ip: string) {

}