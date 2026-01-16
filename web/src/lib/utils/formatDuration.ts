export function formatDuration(totalSeconds?: number | null): string {
  if (!Number.isFinite(totalSeconds ?? NaN) || (totalSeconds ?? 0) <= 0) {
    return "0:00";
  }

  const seconds = Math.floor(totalSeconds ?? 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
