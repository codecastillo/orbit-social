"use client";

import { useSyncExternalStore } from "react";

// Search history is per-device convenience, not account data: it lives in
// localStorage and never touches saved_searches, which is marketplace-scoped
// and synced.

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

function read(): RecentSearch[] {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]"
    );
    return Array.isArray(parsed) ? parsed.filter(isRecentSearch) : [];
  } catch {
    // Corrupt or unavailable store; history is a convenience, start fresh.
    return [];
  }
}

// localStorage is not reactive and useSyncExternalStore needs a referentially
// stable snapshot, so the parsed list is cached here and only replaced when
// this tab writes.
const EMPTY: RecentSearch[] = [];
let snapshot: RecentSearch[] | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RecentSearch[] {
  snapshot ??= read();
  return snapshot;
}

function commit(entries: RecentSearch[]): void {
  snapshot = entries;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // A failed write only costs this device its history.
  }
  for (const listener of listeners) listener();
}

/** The chips strip. Renders empty during SSR and hydration, then fills in. */
export function useRecentSearches(): RecentSearch[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

/** Most recent first, deduplicated, capped. */
function remember(entry: RecentSearch): void {
  const key = identity(entry);
  commit(
    [entry, ...getSnapshot().filter((e) => identity(e) !== key)].slice(
      0,
      MAX_RECENT_SEARCHES
    )
  );
}

/** A "#tag" query is stored as the tag itself so both routes share a chip. */
export function rememberSearchQuery(query: string): void {
  const trimmed = query.trim();
  if (trimmed.length === 0) return;
  if (trimmed.startsWith("#")) {
    remember({ kind: "hashtag", value: trimmed.slice(1) });
  } else {
    remember({ kind: "query", value: trimmed });
  }
}

/** A profile opened from search results, which beats the typo that found it. */
export function rememberVisitedUser(username: string): void {
  remember({ kind: "user", value: username });
}

export function removeRecentSearch(entry: RecentSearch): void {
  const key = identity(entry);
  commit(getSnapshot().filter((e) => identity(e) !== key));
}

export function clearRecentSearches(): void {
  commit(EMPTY);
}

/** The text a chip shows, and the query re-running it should produce. */
export function recentSearchLabel(entry: RecentSearch): string {
  if (entry.kind === "hashtag") return `#${entry.value}`;
  if (entry.kind === "user") return `@${entry.value}`;
  return entry.value;
}
