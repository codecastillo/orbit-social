"use client";

import { useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { PostCard } from "./post-card";
import { FeedSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useFeed } from "@/lib/hooks/use-feed";

interface FeedListProps {
  tab: "foryou" | "following";
}

export function FeedList({ tab }: FeedListProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useFeed(tab);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        { rootMargin: "400px" }
      );

      observerRef.current.observe(node);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  if (isLoading) return <FeedSkeleton />;

  if (isError) {
    return (
      <EmptyState
        title="Something went wrong"
        description="Failed to load posts. Try again."
        action={
          <button
            onClick={() => refetch()}
            className="text-cyan-400 text-sm font-medium hover:underline"
          >
            Retry
          </button>
        }
      />
    );
  }

  const allPosts = data?.pages.flatMap((page) => page.posts) || [];

  if (allPosts.length === 0) {
    return (
      <EmptyState
        title={tab === "following" ? "No posts yet" : "Your feed is empty"}
        description={
          tab === "following"
            ? "Posts from people you follow will appear here."
            : "Follow people or explore to discover content."
        }
      />
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {allPosts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          isLiked={post.user_has_liked}
          isBookmarked={post.user_has_bookmarked}
          onUpdate={() => refetch()}
        />
      ))}

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        </div>
      )}
    </div>
  );
}
