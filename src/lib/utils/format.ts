import { formatDistanceToNowStrict } from "date-fns";

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

/** "Jul 29, 2026" in the viewer's locale. */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "3:45 PM" in the viewer's locale, always 12-hour. */
export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "Jul 29, 2026 at 3:45 PM". */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${formatDate(d)} at ${formatTime(d)}`;
}

export function formatTimeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const str = formatDistanceToNowStrict(d, { addSuffix: false });
  return str
    .replace(" seconds", "s")
    .replace(" second", "s")
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" days", "d")
    .replace(" day", "d")
    .replace(" months", "mo")
    .replace(" month", "mo")
    .replace(" years", "y")
    .replace(" year", "y");
}
