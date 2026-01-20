const LIVE_POLL_INTERVAL_MS = 1500;
const LIVE_POLL_LIMIT = 30;
const LIVE_INSERT_RESET_MS = 2000;
const LIVE_PRESERVE_SCROLL_THRESHOLD = 120;

const COUNTDOWN_INTERVAL_ACTIVE = 1000;
const COUNTDOWN_INTERVAL_HIDDEN = 10000;

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

export { LIVE_POLL_INTERVAL_MS, LIVE_POLL_LIMIT, LIVE_INSERT_RESET_MS, LIVE_PRESERVE_SCROLL_THRESHOLD };

export function parseIntervalMs(interval: string | undefined): number | null {
  if (!interval || interval === "off") return null;

  const match = interval.match(/^(\d+)([mhd])$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  if (!Number.isFinite(value)) return null;

  const unit = match[2];
  if (unit === "m") return value * SECONDS_PER_MINUTE * 1000;
  if (unit === "h") return value * SECONDS_PER_HOUR * 1000;
  if (unit === "d") return value * SECONDS_PER_DAY * 1000;

  return null;
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getCountdownInterval(isHidden: boolean) {
  return isHidden ? COUNTDOWN_INTERVAL_HIDDEN : COUNTDOWN_INTERVAL_ACTIVE;
}
