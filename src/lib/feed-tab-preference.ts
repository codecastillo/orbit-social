const STORAGE_KEY = "orbit-feed-tab";

export type FeedTabPreference = "foryou" | "following";

/**
 * Remembers which feed someone chose.
 *
 * Promise 1 on /promises says "When you pick Following, the choice sticks",
 * and until now it did not: the tab lived in plain component state, so every
 * navigation back to the feed put the reader on For you again. That is the
 * promise most likely to be noticed when broken, because the people who pick
 * Following pick it deliberately.
 *
 * localStorage rather than the profile: it is a per-device reading
 * preference, and fetching it from the server would leave the tabs flickering
 * on every load. Mirrored on mobile at
 * orbit-mobile/src/lib/feed-tab-preference.ts.
 */
export function loadFeedTab(): FeedTabPreference | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "following" || stored === "foryou" ? stored : null;
  } catch {
    // Private-mode browsers throw on storage access. The default applies.
    return null;
  }
}

export function saveFeedTab(tab: FeedTabPreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    // Failing to remember the choice is a small loss; surfacing it mid-click
    // would be a larger one.
  }
}

/**
 * Subscribe for useSyncExternalStore. Storage events only fire in other
 * tabs, which is exactly the case worth reacting to: pick Following in one
 * tab and the others follow.
 */
export function subscribeToFeedTab(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** The server has no localStorage, so it always renders the default. */
export function serverFeedTab(): FeedTabPreference | null {
  return null;
}
