export const API_KEY_MAX_LENGTH = 50;
const CONTROL_CHARS = /\p{Cc}/u;

export type ApiKeyNameResult = { ok: false, error: string } | { ok: true, name: string }

export function validateApiKeyName(raw: unknown): ApiKeyNameResult {
    if (typeof raw !== 'string') return { ok: false, error: 'name must be a string'};
    const normalized = raw.trim();
    if (CONTROL_CHARS.test(normalized)) return { ok: false, error: 'name contains illegal characters' };
    if (normalized === '') return { ok: false, error: 'name cannot be empty' };
    if (normalized.length > API_KEY_MAX_LENGTH) return { ok: false, error: `name must not exceed ${API_KEY_MAX_LENGTH} characters` };

    return { ok: true, name: normalized };
}