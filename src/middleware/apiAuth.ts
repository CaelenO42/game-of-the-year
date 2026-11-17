import type { NextFunction, Request, Response } from 'express';
import { getApiKeyUser, touchApiKey } from '../db/apiKeys.js';

function unauthorized(res: Response) {
    return res.set('WWW-Authenticate', 'Bearer').status(401).json({ error: 'Missing or invalid API key' });
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
    const key = match?.[1];
    if (!key) return unauthorized(res);

    const apiUser = await getApiKeyUser(key);
    if (!apiUser) return unauthorized(res);

    req.user = apiUser.user;
    await touchApiKey(apiUser.keyId);
    next();
}