"use client";

import { useRef, useEffect, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/use-auth";
import { getReels } from "@/lib/queries/reels";
import { checkUserInteractions, type PostWithAuthor } from "@/lib/queries/posts";
import { ReelPlayer } from "./reel-player";
import { Loader2 } from "lucide-react";

export function ReelFeed() {
  const { user } = useAuth();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["reels", user?.id],
    queryFn: async ({ pageParam }) => {
      const reels = await getReels(pageParam, 5);

      let enrichedReels = reels;
      if (reels.length > 0 && user) {
        const postIds = reels.map((r) => r.id);
        const { likedPostIds, bookmarkedPostIds } =
          await checkUserInteractions(user.id, postIds);

        enrichedReels = reels.map((r) => ({
          ...r,
          user_has_liked: likedPostIds.has(r.id),
          user_has_bookmarked: bookmarkedPostIds.has(r.id),
        }));
      }

      const nextCursor =
        reels.length > 0 ? reels[reels.length - 1].created_at : null;

      return { reels: enrichedReels, nextCursor };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user,
    staleTime: 30_000,
  });

  // Intersection observer for infinite scroll
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      threshold: 0.1,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const allReels: PostWithAuthor[] =
    data?.pages.flatMap((page) => page.reels) ?? [];

  if (isLoading) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-black">
        <Loader2 className="size-8 text-white animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-black">
        <p className="text-white/60 text-sm">Failed to load reels.</p>
      </div>
    );
  }

  if (allReels.length === 0) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-black">
        <p className="text-white/60 text-sm">No reels yet. Be the first to post one!</p>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full overflow-y-scroll snap-y-mandatory scrollbar-hide bg-black">
      {allReels.map((reel) => (
        <ReelPlayer key={reel.id} reel={reel} />
      ))}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="h-20 flex items-center justify-center bg-black">
          <Loader2 className="size-6 text-white animate-spin" />
        </div>
      )}
    </div>
  );
}
