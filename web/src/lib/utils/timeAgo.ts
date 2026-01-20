// Date formatters - created once at module level for reuse
const dateFormatterWithYear = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

const dateFormatterNoYear = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
});

/**
 * Compute a human-readable "time ago" string from a date.
 * This is a pure function that takes the current time as a parameter,
 * allowing the parent component to control when updates happen.
 */
export function computeTimeAgo(dateStr: string | null | undefined, nowMs: number): string {
    if (!dateStr) return "";

    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "";

        const seconds = Math.floor((nowMs - date.getTime()) / 1000);

        if (seconds < 60) return "just now";
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

        // For older dates, show the actual date
        const nowDate = new Date(nowMs);
        const isCurrentYear = date.getFullYear() === nowDate.getFullYear();
        return (isCurrentYear ? dateFormatterNoYear : dateFormatterWithYear).format(date);
    } catch {
        return "";
    }
}

/**
 * Format a date string for display (used in tooltips, etc.)
 */
export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "";

    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "";

        const now = new Date();
        const isCurrentYear = date.getFullYear() === now.getFullYear();

        const formatter = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: isCurrentYear ? undefined : "numeric",
            hour: "numeric",
            minute: "2-digit",
        });

        return formatter.format(date);
    } catch {
        return "";
    }
}
