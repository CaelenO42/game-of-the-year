// Only allow same-site paths to avoid open redirects
export function safeNext(value: unknown): string {
    if (typeof value !== "string") return "/";
    if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || /[\u0000-\u001f\u007f]/.test(value)) return "/";
    return value;
}