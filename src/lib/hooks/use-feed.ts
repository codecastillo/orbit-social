"use client";

import { useCallback } from "react";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { useMutedWords, useNotInterestedIds } from "./use-content-safety";
import {
  getFeedPosts,
  getPublicTimeline,
  checkUserInteractions,
  checkUserReposted,
  type PostWithAuthor,
} from "@/lib/queries/posts";
import {
  buildMutedWordMatcher,
  getRankingSignals,
} from "@/lib/queries/content-safety";
import { rankPosts } from "@/lib/services/feed-algorithm";

interface FeedPage {
  posts: PostWithAuthor[];
  nextCursor: string | null;
}

export function useFeed(tab: "foryou" | "following") {
  const { user } = useAuth();
  const { data: mutedWords } = useMutedWords();
  const { data: notInterestedIds } = useNotInterestedIds();

  // Content-safety filtering lives in `select` rather than the queryFn so
  // it re-applies instantly when the viewer mutes a word or marks a post
  // not interested, without refetching pages. Cursors are captured before
  // filtering, so pagination is unaffected.
  const filterPages = useCallback(
    (data: InfiniteData<FeedPage, string | undefined>) => {
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
            return !matchesMutedWord(post.content);
          }),
        })),
      };
    },
    [mutedWords, notInterestedIds]
  );

  return useInfiniteQuery({
    queryKey: ["feed", user ? tab : "public", user?.id ?? "anon"],
    // A failed page must reject so React Query exposes isError and the feed
    // can offer a retry. The old catch-all here turned every outage into a
    // convincing "no posts yet" empty state.
    queryFn: async ({ pageParam }) => {
      // Anon viewers see the public timeline (no follow graph available).
      if (!user) {
        const posts = await getPublicTimeline(pageParam);
        // Cursor comes from the chronological fetch order, before ranking,
        // so pagination stays a clean created_at walk.
        const nextCursor =
          posts.length > 0 ? posts[posts.length - 1].created_at : null;
        return { posts: rankPosts(posts, "anon"), nextCursor };
      }

      const posts = await getFeedPosts(user.id, tab, pageParam);

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

      // Cursor comes from the chronological fetch order, before ranking,
      // so pagination stays a clean created_at walk regardless of tab.
      const nextCursor =
        posts.length > 0 ? posts[posts.length - 1].created_at : null;

      // For You ranks each page's batch in isolation; already-delivered
      // pages are never re-ranked, so nothing reorders under the user's
      // thumb. Following stays strictly chronological and complete.
      const pagePosts =
        tab === "foryou"
          ? rankPosts(
              enrichedPosts,
              user.id,
              undefined,
              // Topic preferences and sensitivity demotion; degrades to
              // neutral signals on failure inside the helper.
              await getRankingSignals(user.id)
            )
          : enrichedPosts;

      return { posts: pagePosts, nextCursor };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: filterPages,
    // 60s staleTime + no refetch on window focus avoids the request storm
    // that fires every time you tab back. Realtime channels still bump
    // the cache when something actually changes.
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
