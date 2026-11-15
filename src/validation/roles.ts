export const ROLES = ['admin', 'user'] as const;
export type Role = typeof ROLES[number];

export function validateRole(raw: unknown): { ok: true, role: Role } | { ok: false, error: string } {
    const s = typeof raw === 'string' ? raw.trim() : raw;

    if (isRole(s)) return { ok: true, role: s };
    return { ok: false, error: `Role must be one of ${ROLES.join(', ')}` };
}

export function isRole(value: unknown): value is Role {
    return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}