"use client";

import { useRef, useEffect, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, Film } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { getClips } from "@/lib/queries/clips";
import { checkUserInteractions, type PostWithAuthor } from "@/lib/queries/posts";
import { ClipPlayer } from "./clip-player";
import { O, aurora, panel } from "@/lib/design/orbit";

export function ClipFeed() {
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
    queryKey: ["clips", user?.id],
    queryFn: async ({ pageParam }) => {
      const clips = await getClips(pageParam, 5);

      let enrichedClips = clips;
      if (clips.length > 0 && user) {
        const postIds = clips.map((c) => c.id);
        const { likedPostIds, bookmarkedPostIds } =
          await checkUserInteractions(user.id, postIds);

        enrichedClips = clips.map((c) => ({
          ...c,
          user_has_liked: likedPostIds.has(c.id),
          user_has_bookmarked: bookmarkedPostIds.has(c.id),
        }));
      }

      const nextCursor =
        clips.length > 0 ? clips[clips.length - 1].created_at : null;

      return { clips: enrichedClips, nextCursor };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user,
    staleTime: 30_000,
  });

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

  const allClips: PostWithAuthor[] =
    data?.pages.flatMap((page) => page.clips) ?? [];

  if (isLoading) {
    return (
      <div
        className="h-full w-full flex items-center justify-center"
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
        className="h-full w-full flex items-center justify-center px-6"
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

  if (allClips.length === 0) {
    return (
      <div
        className="h-full w-full flex items-center justify-center px-6"
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
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      style={{ background: O.bg }}
    >
      {allClips.map((clip) => (
        <ClipPlayer key={clip.id} clip={clip} />
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
