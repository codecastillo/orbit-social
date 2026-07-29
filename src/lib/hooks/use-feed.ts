"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import {
  getFeedPosts,
  getPublicTimeline,
  checkUserInteractions,
  checkUserReposted,
  type PostWithAuthor,
} from "@/lib/queries/posts";

export function useFeed(tab: "foryou" | "following") {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ["feed", user ? tab : "public", user?.id ?? "anon"],
    // A failed page must reject so React Query exposes isError and the feed
    // can offer a retry. The old catch-all here turned every outage into a
    // convincing "no posts yet" empty state.
    queryFn: async ({ pageParam }) => {
      // Anon viewers see the public timeline (no follow graph available).
      if (!user) {
        const posts = await getPublicTimeline(pageParam);
        const nextCursor =
          posts.length > 0 ? posts[posts.length - 1].created_at : null;
        return { posts, nextCursor };
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

      const nextCursor =
        posts.length > 0 ? posts[posts.length - 1].created_at : null;

      return { posts: enrichedPosts, nextCursor };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // 60s staleTime + no refetch on window focus avoids the request storm
    // that fires every time you tab back. Realtime channels still bump
    // the cache when something actually changes.
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
