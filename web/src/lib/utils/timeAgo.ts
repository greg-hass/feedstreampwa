const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_WEEK = 604800;

const dateFormatterWithYear = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

const dateFormatterNoYear = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
});

export function computeTimeAgo(dateStr: string | null | undefined, nowMs: number): string {
    if (!dateStr) return "";

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";

    const seconds = Math.floor((nowMs - date.getTime()) / 1000);

    if (seconds < SECONDS_PER_MINUTE) return "just now";
    if (seconds < SECONDS_PER_HOUR) return `${Math.floor(seconds / SECONDS_PER_MINUTE)}m ago`;
    if (seconds < SECONDS_PER_DAY) return `${Math.floor(seconds / SECONDS_PER_HOUR)}h ago`;
    if (seconds < SECONDS_PER_WEEK) return `${Math.floor(seconds / SECONDS_PER_DAY)}d ago`;

    const nowDate = new Date(nowMs);
    const isCurrentYear = date.getFullYear() === nowDate.getFullYear();
    return (isCurrentYear ? dateFormatterNoYear : dateFormatterWithYear).format(date);
}

export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "";

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
}
