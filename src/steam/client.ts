type SteamHost = "store" | "api";

const HOSTS: Record<SteamHost, string> = {
    store: "https://store.steampowered.com",
    api: "https://api.steampowered.com",
};

export async function querySteam<T>(host: SteamHost, path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(path, HOSTS[host]);

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }

    const res = await fetch(url);
    if (res.status === 429) throw new Error("Steam rate limit exceeded (429)");
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${await res.text()}`);

    return await res.json() as T;
}