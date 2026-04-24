"use client";

import { useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { PostCard } from "./post-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
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
          <button onClick={() => refetch()} className="text-primary text-sm font-medium hover:underline">
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
    <div className="divide-y divide-white/[0.06]">
      {allPosts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          isLiked={post.user_has_liked}
          isBookmarked={post.user_has_bookmarked}
          onUpdate={() => refetch()}
        />
      ))}

      <div ref={loadMoreRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="divide-y divide-white/[0.06]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <div className="flex gap-6">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
