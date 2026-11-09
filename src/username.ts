export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
export const USERNAME_REGEX = new RegExp(`^[A-Za-z0-9][A-Za-z0-9_\\-]{${USERNAME_MIN - 2},${USERNAME_MAX - 2}}[A-Za-z0-9]$`);

const PROTECTED_NAMES = new Set(["admin", "administrator", "staff", "mod", "moderator", "support", "help", "team", "official", "system", "root"]);

export function validateUsername(raw: unknown): { ok: true; username: string } | { ok: false; username: string; error: string } {
    if (!raw || typeof raw !== "string") return { ok: false, username: "", error: "Username required." };
    const username = raw.trim().toLowerCase();
    if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) return { ok: false, username, error: `Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters.` };
    if (!USERNAME_REGEX.test(username)) return { ok: false, username, error: "Username must contain only letters, numbers, and -_, and must start with a letter or number" };
    if (PROTECTED_NAMES.has(username)) return { ok: false, username, error: "That username is reserved." };

    return { ok: true, username };
}
