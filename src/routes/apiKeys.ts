import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createApiKey, deleteApiKeyById, listApiKeys } from "../db/apiKeys.js";
import { validateApiKeyName } from "../validation/apiKey.js";

export const apiKeyRouter = Router();

const MAX_API_KEYS = 5;

apiKeyRouter.get('/settings/api-keys', requireAuth, async (req, res) => {
    if (!req.user) return res.status(401).end();

    const apiKeys = await listApiKeys(req.user.id);

    return res.render('users/api_keys', { apiKeys, MAX_API_KEYS, apiKeyCount: apiKeys.length });
})

apiKeyRouter.post('/settings/api-keys', requireAuth, async (req, res) => {
    if (!req.user) return res.status(401).end();

    const validate = validateApiKeyName(req.body.name);
    if (!validate.ok) return res.status(400).json({ error: validate.error });

    const apiKeys = await listApiKeys(req.user.id);
    if (apiKeys.length >= MAX_API_KEYS) return res.status(400).json({ error: 'You have exceeded the maximum number of API keys' });

    const created = await createApiKey(req.user.id, validate.name);

    res.set('Cache-Control', 'no-store');
    return res.status(201).render('users/partials/api_key_created', { apiKey: created, MAX_API_KEYS, oob: true, apiKeyCount: apiKeys.length + 1 });
})

apiKeyRouter.delete('/settings/api-keys/:id', requireAuth, async (req, res) => {
    if (!req.user) return res.status(401).end();

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id must be a valid number' });

    const result = await deleteApiKeyById(req.user.id, id);
    if (result === 0) return res.status(404).json({ error: 'you must specify a valid api key' });
    const apiKeys = await listApiKeys(req.user.id);
    return res.status(200).render('users/partials/api_key_controls', { oob: true, MAX_API_KEYS, apiKeyCount: apiKeys.length });
})