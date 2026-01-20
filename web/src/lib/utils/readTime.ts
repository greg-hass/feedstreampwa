const WORDS_PER_MINUTE = 225;

export function calculateReadTime(html: string): number {
    if (!html) return 0;

    const text = html.replace(/<[^>]*>/g, ' ');
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const minutes = Math.ceil(words.length / WORDS_PER_MINUTE);

    return Math.max(1, minutes);
}

export function formatReadTime(minutes: number): string {
    if (minutes === 1) return '1 min read';
    if (minutes < 60) return `${minutes} min read`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
        return hours === 1 ? '1 hour read' : `${hours} hours read`;
    }

    return `${hours}h ${remainingMinutes}m read`;
}
