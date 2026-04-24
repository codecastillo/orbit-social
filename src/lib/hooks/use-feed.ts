"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import {
  getFeedPosts,
  checkUserInteractions,
  checkUserReposted,
  type PostWithAuthor,
} from "@/lib/queries/posts";

export function useFeed(tab: "foryou" | "following") {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ["feed", tab, user?.id],
    queryFn: async ({ pageParam }) => {
      if (!user) return { posts: [] as PostWithAuthor[], nextCursor: null };

      try {
        const posts = await getFeedPosts(user.id, tab, pageParam);

        // Check user interactions for this batch
        let enrichedPosts = posts;
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
      } catch (error) {
        console.error("Feed fetch error:", error);
        return { posts: [] as PostWithAuthor[], nextCursor: null };
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}
