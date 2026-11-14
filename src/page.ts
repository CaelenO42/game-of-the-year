export function normalizePage(value: unknown, maxPage: number): number {
    const page = Math.floor(Number(value));
    if (!Number.isFinite(page)) return 1;
    return Math.min(Math.max(page, 1), maxPage);
}