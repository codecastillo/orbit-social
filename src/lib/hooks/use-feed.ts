"use client";

import { useCallback } from "react";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import {
  useMutedIds,
  useMutedWords,
  useNotInterestedIds,
} from "./use-content-safety";
import {
  getFeedPosts,
  getPublicTimeline,
  getRankedFeedPosts,
  checkUserInteractions,
  checkUserReposted,
  RANKED_EXCLUDE_CAP,
  type PostWithAuthor,
} from "@/lib/queries/posts";
import {
  buildMutedWordMatcher,
  getRankingSignals,
} from "@/lib/queries/content-safety";
import { isRankingEnabled } from "@/lib/queries/feed-ranking";
import { rankPosts } from "@/lib/services/feed-algorithm";

interface FeedPage {
  posts: PostWithAuthor[];
  nextCursor: string | null;
  // Ids delivered so far, handed back to feed_for_you as p_exclude. Null on
  // every page that came from the chronological path.
  nextExcludeIds: string[] | null;
}

// The chronological path paginates on a created_at cursor; the ranked path
// has no cursor and paginates by excluding what it already delivered.
interface FeedPageParam {
  cursor?: string;
  excludeIds?: string[];
}

export function useFeed(tab: "foryou" | "following") {
  const { user, loading: authLoading } = useAuth();
  const { data: mutedWords } = useMutedWords();
  const { data: mutedIds } = useMutedIds();
  const { data: notInterestedIds } = useNotInterestedIds();

  // Content-safety filtering lives in `select` rather than the queryFn so
  // it re-applies instantly when the viewer mutes a word or marks a post
  // not interested, without refetching pages. Cursors are captured before
  // filtering, so pagination is unaffected.
  const filterPages = useCallback(
    (data: InfiniteData<FeedPage, FeedPageParam | undefined>) => {
      const matchesMutedWord = buildMutedWordMatcher(mutedWords ?? []);
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          posts: page.posts.filter((post) => {
            // Feedback on a repost row targets the original it displays.
            const feedbackId =
              post.type === "repost" && post.parent_post_id
                ? post.parent_post_id
                : post.id;
            if (notInterestedIds?.has(feedbackId)) return false;
            // A mute hides the account's posts from feeds only; their
            // profile stays fully visible when someone visits it.
            if (mutedIds?.has(post.user_id)) return false;
            return !matchesMutedWord(post.content);
          }),
        })),
      };
    },
    [mutedWords, mutedIds, notInterestedIds]
  );

  return useInfiniteQuery({
    queryKey: ["feed", user ? tab : "public", user?.id ?? "anon"],
    // A failed page must reject so React Query exposes isError and the feed
    // can offer a retry. The old catch-all here turned every outage into a
    // convincing "no posts yet" empty state.
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam?.cursor;
      const excludeIds = pageParam?.excludeIds;

      // Anon viewers see the public timeline (no follow graph available).
      if (!user) {
        const posts = await getPublicTimeline(cursor);
        // Cursor comes from the chronological fetch order, before ranking,
        // so pagination stays a clean created_at walk.
        const nextCursor =
          posts.length > 0 ? posts[posts.length - 1].created_at : null;
        return {
          posts: rankPosts(posts, "anon"),
          nextCursor,
          nextExcludeIds: null,
        };
      }

      // Server-side ranker, off for everyone outside the rollout. It returns
      // null on any failure, which drops this page onto the chronological
      // path below with nothing surfaced to the viewer.
      const rankedPosts =
        tab === "foryou" && (await isRankingEnabled(user.id))
          ? await getRankedFeedPosts(user.id, excludeIds ?? [])
          : null;

      let posts: PostWithAuthor[];
      let nextCursor: string | null;
      let nextExcludeIds: string[] | null;

      if (rankedPosts) {
        posts = rankedPosts;
        nextCursor = null;
        nextExcludeIds = [
          ...(excludeIds ?? []),
          ...rankedPosts.map((p) => p.id),
        ].slice(-RANKED_EXCLUDE_CAP);
      } else {
        const fetched = await getFeedPosts(user.id, tab, cursor);
        // Cursor comes from the chronological fetch order, before ranking,
        // so pagination stays a clean created_at walk regardless of tab.
        nextCursor =
          fetched.length > 0 ? fetched[fetched.length - 1].created_at : null;
        nextExcludeIds = null;
        // Dropping out of ranked mode mid-scroll restarts the chronological
        // walk at the newest post, so skip what the ranked pages delivered.
        if (excludeIds) {
          const delivered = new Set(excludeIds);
          posts = fetched.filter((p) => !delivered.has(p.id));
        } else {
          posts = fetched;
        }
      }

      let enrichedPosts: PostWithAuthor[] = posts;
      if (posts.length > 0) {
        try {
          const postIds = posts.map((p) => p.id);
          const [{ likedPostIds, bookmarkedPostIds }, repostedPostIds] =
            await Promise.all([
              checkUserInteractions(user.id, postIds),
              checkUserReposted(user.id, postIds),
            ]);

          enrichedPosts = posts.map((p) => ({
            ...p,
            user_has_liked: likedPostIds.has(p.id),
            user_has_bookmarked: bookmarkedPostIds.has(p.id),
            user_has_reposted: repostedPostIds.has(p.id),
          }));
        } catch {
          // Interaction flags are decoration; the feed itself still renders.
          enrichedPosts = posts.map((p) => ({
            ...p,
            user_has_liked: false,
            user_has_bookmarked: false,
            user_has_reposted: false,
          }));
        }
      }

      // For You ranks each page's batch in isolation; already-delivered
      // pages are never re-ranked, so nothing reorders under the user's
      // thumb. Following stays strictly chronological and complete. A ranked
      // page arrives already ordered by the server, so it skips this.
      const pagePosts =
        tab === "foryou" && !rankedPosts
          ? rankPosts(
              enrichedPosts,
              user.id,
              undefined,
              // Topic preferences and sensitivity demotion; degrades to
              // neutral signals on failure inside the helper.
              await getRankingSignals(user.id)
            )
          : enrichedPosts;

      return { posts: pagePosts, nextCursor, nextExcludeIds };
    },
    initialPageParam: undefined as FeedPageParam | undefined,
    getNextPageParam: (lastPage): FeedPageParam | undefined => {
      if (lastPage.nextExcludeIds) {
        return { excludeIds: lastPage.nextExcludeIds };
      }
      return lastPage.nextCursor ? { cursor: lastPage.nextCursor } : undefined;
    },
    select: filterPages,
    // The key flips from the public timeline to the signed-in feed the
    // moment auth resolves. Fetching before then costs a full anon page
    // that is thrown away on every cold load for a signed-in viewer.
    enabled: !authLoading,
    // 60s staleTime + no refetch on window focus avoids the request storm
    // that fires every time you tab back. Realtime channels still bump
    // the cache when something actually changes.
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
