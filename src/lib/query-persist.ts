"use client";

import type { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";

const STORAGE_KEY = "orbit-query-cache";

/**
 * A restored cache older than this is dropped rather than shown: past a day
 * the counts and previews are wrong often enough that a skeleton is honest.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Bump to invalidate every persisted cache after a breaking shape change.
 * v2 also discards the caches written while the old exclusion list let
 * search terms, block lists and moderation queues reach localStorage.
 */
const CACHE_BUSTER = "v2";

/** Prefix of the current-profile snapshots use-profile writes for first paint. */
export const PROFILE_SNAPSHOT_PREFIX = "current-profile:";

/**
 * The only query key roots that may reach localStorage: durable content a
 * revisit should paint instantly, plus the profile rows that frame it.
 *
 * This is an allowlist on purpose. The previous denylist persisted every
 * query nobody had thought to exclude, so each new hook silently opted its
 * data in, which is how search terms, block and mute lists, follow requests,
 * story viewers and the admin moderation queues ended up on disk. Anything
 * absent here stays in memory: private or viewer-scoped state (messages,
 * unread badges, blocks, mutes, drafts, bookmarks, moderation), live state
 * that is wrong the moment it is restored (presence, live streams), and
 * search results keyed by whatever the user typed.
 *
 * Add a root only when the data is durable, shown on a revisit, and no worse
 * to leave on a shared machine than the page that displays it.
 */
const PERSISTABLE_KEYS = new Set([
  // Timeline and discovery content
  "feed",
  "feed-newest",
  "trending-posts",
  "trending-hashtags",
  "hashtag",
  "location-posts",
  // Single posts and their threads
  "post",
  "comments",
  "comment-replies",
  // Clips and sounds
  "clips",
  "clip",
  "clip-comments",
  "best-loops",
  "sound",
  "sound-clips",
  // Recorded video (live state is deliberately absent)
  "vod",
  "vod-streamer",
  "user-vods",
  // Profiles and their tabs
  "current-profile",
  "profile-meta",
  "profile-tab-counts",
  "user-posts",
  "user-clips",
  "user-liked-posts",
  "user-pinned-posts",
  "user-reposted-posts",
  "user-tagged-posts",
  "story-highlights",
  // The viewer's own libraries. Each has a page dedicated to showing it,
  // and sign-out drops the whole store, so a restore only ever hands the
  // data back to the account that put it there.
  "user-saved-posts",
  "post-drafts",
  "archived-stories",
  // Communities
  "communities",
  "community",
  "community-posts",
  "community-members",
  "community-members-full",
]);

export const queryPersister = createSyncStoragePersister({
  storage: typeof window === "undefined" ? undefined : window.localStorage,
  key: STORAGE_KEY,
  throttleTime: 2000,
});

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: queryPersister,
  maxAge: MAX_AGE_MS,
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === "success" &&
      PERSISTABLE_KEYS.has(String(query.queryKey[0])),
  },
};

/**
 * Drops the stored copy of the cache. Clearing the in-memory client alone
 * would leave the outgoing account's data on disk for the next restore.
 */
export function clearPersistedQueryCache(): void {
  try {
    queryPersister.removeClient();
  } catch {
    // A storage write that fails leaves a stale cache the buster and maxAge
    // will eventually reject; failing the sign-out over it would be worse.
  }
}

/** Removes every account's cached name and avatar snapshot. */
function clearProfileSnapshots(): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    const stale: string[] = [];
    // Collected before removing: removing during the walk shifts the indices.
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(PROFILE_SNAPSHOT_PREFIX)) stale.push(key);
    }
    for (const key of stale) storage.removeItem(key);
  } catch {
    /* private-mode storage failures are not worth failing a sign-out over */
  }
}

/**
 * Everything the outgoing account left behind, in one place. Runs on every
 * sign-out, however it was triggered, so the next person to sign in on this
 * machine cannot rehydrate the previous account's feed, profile, bookmarks
 * or notifications.
 */
export function clearAccountScope(queryClient: QueryClient): void {
  // A cached page from another account is a data leak, not a stale render.
  queryClient.clear();
  // The on-disk copy outlives the tab, so clearing memory alone would hand
  // the outgoing account's data to the next cold start.
  clearPersistedQueryCache();
  clearProfileSnapshots();
}
