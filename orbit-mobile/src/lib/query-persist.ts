import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";

const STORAGE_KEY = "orbit-query-cache";

/**
 * A restored cache older than this is dropped rather than shown: past a day
 * the counts and previews are wrong often enough that a skeleton is honest.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Bump to invalidate every persisted cache after a breaking shape change. */
// v2 discards caches written by the first release, which persisted queries
// that resolve to Sets and crashed the feed on restore.
const CACHE_BUSTER = "v2";

/**
 * Query key prefixes that never reach the device's storage, mirroring the
 * web client's exclusions and extending them for what only mobile has.
 *
 * - Private message content and its derivatives. The web app makes the same
 *   call; a conversation preview sitting in AsyncStorage is worth more to
 *   someone holding the phone than the tenth of a second it saves.
 * - Live-by-definition state (presence, unread badges): a restored copy is
 *   wrong the moment it is read, and the queries refetch on mount anyway.
 * - Credentials and account security history, which are secrets and audit
 *   data respectively, not view state.
 * - Search results, keyed by a typed term. They would fill the store with
 *   entries that are never read a second time.
 * - Ranking signals, which are large, churn constantly, and are rebuilt per
 *   session by the ranking code that owns them.
 */
const UNPERSISTED_KEYS = new Set([
  "conversations",
  "messages",
  "message-media",
  "message-reactions",
  "pinned-messages",
  "dm-seen",
  "unread-messages",
  "unread-notifications",
  "presence",
  "presence-many",
  "stream-credentials",
  "login-events",
  "search-users",
  "search-posts",
  "search-clips",
  "close-friend-search",
  "new-group-search",
  "conversation-add-search",
  "community-invite-search",
  "event-cohost-search",
  "ranking-signals",
  // These resolve to Set objects. JSON has no Set, so a persisted one comes
  // back as {} and every .has() call on it throws at render. The guard below
  // catches this class in general; the names are listed too so the intent is
  // obvious to the next person adding a query here.
  "blocked-ids",
  "muted-ids",
  "not-interested",
  "restricted-users",
]);

/**
 * True when the value survives a JSON round trip intact. Sets and Maps do
 * not: they serialize to {} and rehydrate as a plain object, so any method
 * call on them throws. Checking one level deep is enough, because every
 * query here returns either a primitive, an array of rows, or an object of
 * such values.
 */
function isJsonSafe(value: unknown): boolean {
  if (value instanceof Set || value instanceof Map) return false;
  if (Array.isArray(value)) return value.every((v) => !(v instanceof Set || v instanceof Map));
  if (value && typeof value === "object") {
    return Object.values(value).every(
      (v) => !(v instanceof Set || v instanceof Map),
    );
  }
  return true;
}

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
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
      !UNPERSISTED_KEYS.has(String(query.queryKey[0])) &&
      isJsonSafe(query.state.data),
  },
};

/**
 * Drops the stored copy of the cache. Clearing the in-memory client alone
 * would leave the outgoing account's data on disk for the next restore, so
 * this runs alongside it on every account switch and sign-out.
 */
export async function clearPersistedQueryCache(): Promise<void> {
  try {
    await queryPersister.removeClient();
  } catch {
    // A storage write that fails leaves a stale cache the buster and maxAge
    // will eventually reject; failing the switch over it would be worse.
  }
}
