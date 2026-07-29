/**
 * Microtask batching for per-card lookups. Every PostCard in a feed asks for
 * its own reactions, poll vote, and repost data on mount; issuing those as
 * individual requests turned a 20-post page into 40+ round trips. These
 * loaders coalesce all calls made within a 10ms window into one `.in()`
 * query, so a whole feed render costs a handful of requests regardless of
 * how many cards mount.
 */
import {
  getPostsReactionCounts,
  getUserReactions,
  type ReactionCount,
  type ReactionType,
} from "./reactions";
import {
  checkUserInteractions,
  getPostsByIds,
  getUserPollVotes,
  type PostWithAuthor,
} from "./posts";

const BATCH_WINDOW_MS = 10;

type Waiter<T> = { resolve: (value: T) => void; reject: (err: unknown) => void };

function createBatcher<T>(
  run: (ids: string[]) => Promise<Map<string, T>>,
  miss: T,
): (id: string) => Promise<T> {
  let queue = new Map<string, Waiter<T>[]>();
  let scheduled = false;

  return (id: string) =>
    new Promise<T>((resolve, reject) => {
      const waiters = queue.get(id);
      if (waiters) waiters.push({ resolve, reject });
      else queue.set(id, [{ resolve, reject }]);

      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        const batch = queue;
        queue = new Map();
        scheduled = false;
        try {
          const results = await run(Array.from(batch.keys()));
          for (const [key, keyWaiters] of batch) {
            const value = results.has(key) ? results.get(key)! : miss;
            for (const w of keyWaiters) w.resolve(value);
          }
        } catch (err) {
          for (const keyWaiters of batch.values()) {
            for (const w of keyWaiters) w.reject(err);
          }
        }
      }, BATCH_WINDOW_MS);
    });
}

// User-scoped loaders get one batcher per user id (in practice one per
// session; the map exists so a sign-out/sign-in never mixes results).
function perUser<T>(
  factory: (userId: string) => (id: string) => Promise<T>,
): (userId: string, id: string) => Promise<T> {
  const byUser = new Map<string, (id: string) => Promise<T>>();
  return (userId, id) => {
    let loader = byUser.get(userId);
    if (!loader) {
      loader = factory(userId);
      byUser.set(userId, loader);
    }
    return loader(id);
  };
}

export const loadPostReactions: (postId: string) => Promise<ReactionCount[]> =
  createBatcher((ids) => getPostsReactionCounts(ids), []);

export const loadUserReaction: (
  userId: string,
  postId: string,
) => Promise<ReactionType | null> = perUser((userId) =>
  createBatcher<ReactionType | null>(
    (ids) => getUserReactions(userId, ids),
    null,
  ),
);

export const loadUserPollVote: (
  userId: string,
  postId: string,
) => Promise<number | null> = perUser((userId) =>
  createBatcher<number | null>((ids) => getUserPollVotes(userId, ids), null),
);

export const loadPostById: (postId: string) => Promise<PostWithAuthor | null> =
  createBatcher<PostWithAuthor | null>((ids) => getPostsByIds(ids), null);

export interface UserPostInteractions {
  liked: boolean;
  bookmarked: boolean;
  reposted: boolean;
}

export const loadUserInteractions: (
  userId: string,
  postId: string,
) => Promise<UserPostInteractions> = perUser((userId) =>
  createBatcher<UserPostInteractions>(async (ids) => {
    const { likedPostIds, bookmarkedPostIds, repostedPostIds } =
      await checkUserInteractions(userId, ids);
    return new Map(
      ids.map((id) => [
        id,
        {
          liked: likedPostIds.has(id),
          bookmarked: bookmarkedPostIds.has(id),
          reposted: repostedPostIds.has(id),
        },
      ]),
    );
  }, { liked: false, bookmarked: false, reposted: false }),
);
