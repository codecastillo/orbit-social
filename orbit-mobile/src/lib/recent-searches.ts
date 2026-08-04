import AsyncStorage from "@react-native-async-storage/async-storage";

// Search history is per-device convenience, not account data: it lives in
// AsyncStorage and never touches saved_searches, which is marketplace-scoped
// and synced. Same storage shape and cap as the web src/lib/recent-searches.

const STORAGE_KEY = "orbit-recent-searches";

export const MAX_RECENT_SEARCHES = 8;

/**
 * One list carries both what people typed and what they opened from the
 * results, so the strip stays a single compact row of chips instead of two
 * competing sections.
 */
export type RecentSearch =
  | { kind: "query"; value: string }
  | { kind: "hashtag"; value: string }
  | { kind: "user"; value: string };

function isRecentSearch(entry: unknown): entry is RecentSearch {
  if (typeof entry !== "object" || entry === null) return false;
  const { kind, value } = entry as { kind?: unknown; value?: unknown };
  return (
    (kind === "query" || kind === "hashtag" || kind === "user") &&
    typeof value === "string" &&
    value.length > 0
  );
}

function identity(entry: RecentSearch): string {
  return `${entry.kind}:${entry.value.toLowerCase()}`;
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter(isRecentSearch) : [];
  } catch {
    // Corrupt or unreadable store; history is a convenience, start fresh.
    return [];
  }
}

async function write(entries: RecentSearch[]): Promise<RecentSearch[]> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // A failed write only costs this device its history.
  }
  return entries;
}

/** Most recent first, deduplicated, capped. Returns the resulting list. */
async function remember(entry: RecentSearch): Promise<RecentSearch[]> {
  const key = identity(entry);
  const current = await getRecentSearches();
  return write(
    [entry, ...current.filter((e) => identity(e) !== key)].slice(
      0,
      MAX_RECENT_SEARCHES,
    ),
  );
}

/** A "#tag" query is stored as the tag itself so both routes share a chip. */
export async function rememberSearchQuery(
  query: string,
): Promise<RecentSearch[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return getRecentSearches();
  return trimmed.startsWith("#")
    ? remember({ kind: "hashtag", value: trimmed.slice(1) })
    : remember({ kind: "query", value: trimmed });
}

/** A profile opened from search results, which beats the typo that found it. */
export function rememberVisitedUser(username: string): Promise<RecentSearch[]> {
  return remember({ kind: "user", value: username });
}

export async function removeRecentSearch(
  entry: RecentSearch,
): Promise<RecentSearch[]> {
  const key = identity(entry);
  const current = await getRecentSearches();
  return write(current.filter((e) => identity(e) !== key));
}

export function clearRecentSearches(): Promise<RecentSearch[]> {
  return write([]);
}

/** The text a chip shows, and the query re-running it should produce. */
export function recentSearchLabel(entry: RecentSearch): string {
  if (entry.kind === "hashtag") return `#${entry.value}`;
  if (entry.kind === "user") return `@${entry.value}`;
  return entry.value;
}
