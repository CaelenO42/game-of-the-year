type ReviewResult = { ok: true, review: string, spoilers: boolean }
                    | { ok: false, error: string }

export const REVIEW_MAX_LENGTH = 4096;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function validateReviewBody(text: unknown, spoiler: unknown): ReviewResult {
    if (typeof text !== 'string') return { ok: false, error: 'text must be a string'};
    const normalized = text.trim().replace(/\r\n?/g, '\n');
    if (CONTROL_CHARS.test(normalized)) return { ok: false, error: 'text contains illegal characters'};
    if (normalized === '') return { ok: false, error: 'text cannot be empty' };
    if (normalized.length > REVIEW_MAX_LENGTH) return { ok: false, error: `text must not exceed ${REVIEW_MAX_LENGTH} characters` }

    const spoilers = spoiler === 'true' || spoiler === 'on';

    return { ok: true, review: normalized, spoilers };
}