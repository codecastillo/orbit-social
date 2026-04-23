"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import {
  getFeedPosts,
  checkUserInteractions,
  type PostWithAuthor,
} from "@/lib/queries/posts";

export function useFeed(tab: "foryou" | "following") {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ["feed", tab, user?.id],
    queryFn: async ({ pageParam }) => {
      if (!user) return { posts: [], nextCursor: null };

      const posts = await getFeedPosts(user.id, tab, pageParam);

      // Check user interactions for this batch
      let enrichedPosts = posts;
      if (posts.length > 0) {
        const postIds = posts.map((p) => p.id);
        const { likedPostIds, bookmarkedPostIds } =
          await checkUserInteractions(user.id, postIds);

        enrichedPosts = posts.map((p) => ({
          ...p,
          user_has_liked: likedPostIds.has(p.id),
          user_has_bookmarked: bookmarkedPostIds.has(p.id),
        }));
      }

      const nextCursor =
        posts.length > 0 ? posts[posts.length - 1].created_at : null;

      return { posts: enrichedPosts, nextCursor };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user,
    staleTime: 30_000,
  });
}
