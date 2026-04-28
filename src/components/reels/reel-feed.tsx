"use client";

import { useRef, useEffect, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, Film } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { getReels } from "@/lib/queries/reels";
import { checkUserInteractions, type PostWithAuthor } from "@/lib/queries/posts";
import { ReelPlayer } from "./reel-player";
import { O, aurora, panel } from "@/lib/design/orbit";

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
      <div
        className="h-dvh w-full flex items-center justify-center"
        style={{ background: O.bg }}
      >
        <Loader2
          style={{ width: 32, height: 32, color: O.ink2 }}
          className="animate-spin"
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="h-dvh w-full flex items-center justify-center px-6"
        style={{ background: O.bg }}
      >
        <div style={{ ...panel(), padding: "24px 28px", textAlign: "center" }}>
          <p style={{ fontFamily: O.sans, color: O.ink2, fontSize: 14 }}>
            Couldn&apos;t load clips. Pull down to retry.
          </p>
        </div>
      </div>
    );
  }

  if (allReels.length === 0) {
    return (
      <div
        className="h-dvh w-full flex items-center justify-center px-6"
        style={{ background: O.bg }}
      >
        <div
          style={{
            ...panel(),
            padding: "32px 28px",
            textAlign: "center",
            maxWidth: 360,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: aurora,
              display: "grid",
              placeItems: "center",
              boxShadow: `0 12px 32px -10px ${O.a2}66`,
            }}
          >
            <Film style={{ width: 26, height: 26, color: "white" }} strokeWidth={1.8} />
          </div>
          <div>
            <h2
              style={{
                fontFamily: O.sans,
                color: O.ink,
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              No clips yet
            </h2>
            <p
              style={{
                fontFamily: O.sans,
                color: O.ink3,
                fontSize: 13,
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              Post a video from anywhere on Orbit and it lands here automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-dvh w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      style={{ background: O.bg }}
    >
      {allReels.map((reel) => (
        <ReelPlayer key={reel.id} reel={reel} />
      ))}

      <div ref={sentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div
          className="h-20 flex items-center justify-center"
          style={{ background: O.bg }}
        >
          <Loader2
            style={{ width: 22, height: 22, color: O.ink3 }}
            className="animate-spin"
          />
        </div>
      )}
    </div>
  );
}
