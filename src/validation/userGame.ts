export const STATUSES = ['playing', 'completed', 'plan_to_play', 'on_hold', 'dropped'] as const;
export type Status = typeof STATUSES[number];

type RatingResult = { ok: true, rating: number | null }
                    | { ok: false, error: string }

type StatusResult = { ok: true, status: Status | null }
                    | { ok: false, error: string }

const RATING_REGEX = /^-?\d+(\.\d+)?$/;
const RATING_MIN = 0;
const RATING_MAX = 100;

const clamp = (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
}

export function validateRating(raw: unknown): RatingResult {
    if (raw === null || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, rating: null };

    let num: number;
    if (typeof raw === 'number') {
        num = raw;
    } else if (typeof raw === 'string' && RATING_REGEX.test(raw.trim())) {
        num = Number(raw.trim());
    } else {
        return { ok: false, error: 'Rating must be a number between 0 and 100' };
    }

    if (!Number.isFinite(num)) return { ok: false, error: 'Rating must be a number between 0 and 100' };
    return { ok: true, rating: Math.round(clamp(num, RATING_MIN, RATING_MAX)) };
}

export function isStatus(value: unknown): value is Status {
    return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

export function validateStatus(raw: unknown): StatusResult {
    const s = typeof raw === 'string' ? raw.trim() : raw;

    if (s === null || s === '') return { ok: true, status: null };
    if (isStatus(s)) return { ok: true, status: s };
    return { ok: false, error: `Status must be one of ${STATUSES.join(', ')}` };
}