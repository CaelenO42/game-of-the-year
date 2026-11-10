const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year',   365 * 24 * 3600],
    ['month',   30 * 24 * 3600],
    ['week',     7 * 24 * 3600],
    ['day',          24 * 3600],
    ['hour',              3600],
    ['minute',              60],
];

export function timeAgo(date: Date, now = new Date()): string {
    const seconds = Math.trunc((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    for (const [unit, size] of UNITS) {
        if (seconds >= size) return rtf.format(-Math.trunc(seconds / size), unit);
    }
    return 'just now';
}
