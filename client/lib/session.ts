import { getIdToken, type User } from "firebase/auth";

export type SessionResult =
    | { ok: true, redirect: string }
    | { ok: false, error: string };

export async function createSession(user: User): Promise<SessionResult> {
    const idToken = await getIdToken(user);

    const res = await fetch("/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
    });

    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Something went wrong." };
    return { ok: true, redirect: data.redirect };
}
