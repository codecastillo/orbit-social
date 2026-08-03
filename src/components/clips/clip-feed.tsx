"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Film } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useMutedWords } from "@/lib/hooks/use-content-safety";
import { buildMutedWordMatcher } from "@/lib/queries/content-safety";
import { getClips, getCuratedClips } from "@/lib/queries/clips";
import { checkUserInteractions, type PostWithAuthor } from "@/lib/queries/posts";
import { ClipPlayer } from "./clip-player";

/** Stamp per-viewer like/bookmark/loop-it state onto a page of clips. */
async function enrichWithInteractions(
  clips: PostWithAuthor[],
  userId: string | undefined,
): Promise<PostWithAuthor[]> {
  if (clips.length === 0 || !userId) return clips;
  const { likedPostIds, bookmarkedPostIds, repostedPostIds } =
    await checkUserInteractions(
      userId,
      clips.map((c) => c.id),
    );
  return clips.map((c) => ({
    ...c,
    user_has_liked: likedPostIds.has(c.id),
    user_has_bookmarked: bookmarkedPostIds.has(c.id),
    user_has_reposted: repostedPostIds.has(c.id),
  }));
}

export function ClipFeed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data: mutedWords } = useMutedWords();

  // Same matcher the home feed and comments use, applied in `select` so
  // muting a word drops matching captions from the pager instantly, with
  // no refetch. Cursors are captured before filtering, so pagination is
  // unaffected. The curated shelf below runs through it too.
  const matchesMutedWord = useMemo(
    () => buildMutedWordMatcher(mutedWords ?? []),
    [mutedWords],
  );

  // Note: previously this hook subscribed to every INSERT on `posts` with
  // type='reel' and busted the entire ["clips"] cache on each. That made
  // every creator's upload anywhere on the platform thrash every viewer's
  // clip cache. The 30s staleTime + visibility-driven prefetch already
  // surfaces new clips without that. Removed.

  // Scroll to the previous/next clip-snap section.
  const scrollByOne = useCallback((dir: 1 | -1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ top: dir * scroller.clientHeight, behavior: "smooth" });
  }, []);

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
      const enrichedClips = await enrichWithInteractions(clips, user?.id);

      const nextCursor =
        clips.length > 0 ? clips[clips.length - 1].created_at : null;

      return { clips: enrichedClips, nextCursor };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (result) => ({
      ...result,
      pages: result.pages.map((page) => ({
        ...page,
        clips: page.clips.filter((clip) => !matchesMutedWord(clip.content)),
      })),
    }),
    staleTime: 30_000,
  });

  // Weekly Best Loops curation, pinned at the front of the pager with a
  // badge on each curated clip. Empty table degrades to the plain feed.
  const { data: bestLoops } = useQuery({
    queryKey: ["best-loops", user?.id],
    queryFn: async () =>
      enrichWithInteractions(await getCuratedClips(), user?.id),
    select: (clips) => clips.filter((clip) => !matchesMutedWord(clip.content)),
    staleTime: 5 * 60_000,
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
    const scroller = scrollerRef.current;
    if (!sentinel) return;

    // root: scrollerRef so intersections are computed against the snap
    // container (not the viewport, the scroller is fixed-size).
    // rootMargin: 2 viewports below the bottom edge so we start fetching
    // when the viewer is still 2 clips away from the end. Without this
    // the snap-mandatory layout parks the user one clip short of the
    // sentinel and they'd have to manually scroll to trigger more.
    const observer = new IntersectionObserver(handleIntersect, {
      root: scroller,
      rootMargin: "200% 0px 200% 0px",
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  // Also kick a fetch when we've rendered the last clip, covers the case
  // where IntersectionObserver hasn't fired yet but the user is already
  // near the end. React Query dedupes if a fetch is already in-flight.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const onScroll = () => {
        const distanceFromBottom =
          scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        if (distanceFromBottom < scroller.clientHeight * 1.5) {
          fetchNextPage();
        }
      };
      scroller.addEventListener("scroll", onScroll, { passive: true });
      return () => scroller.removeEventListener("scroll", onScroll);
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Curated clips lead; drop their duplicates from the chronological
  // pages so a curated clip never renders twice in the pager.
  const curated = bestLoops ?? [];
  const curatedIds = new Set(curated.map((c) => c.id));
  const feedClips: PostWithAuthor[] =
    data?.pages
      .flatMap((page) => page.clips)
      .filter((c) => !curatedIds.has(c.id)) ?? [];
  const allClips: PostWithAuthor[] = [...curated, ...feedClips];

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full w-full flex items-center justify-center px-6 bg-background">
        <div className="rounded-xl border border-border bg-surface px-7 py-6 text-center">
          <p className="text-sm text-text-secondary">
            Couldn&apos;t load clips. Pull down to retry.
          </p>
        </div>
      </div>
    );
  }

  if (allClips.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center px-6 bg-background">
        <div className="flex max-w-[360px] flex-col items-center gap-3.5 rounded-xl border border-border bg-surface px-7 py-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-primary">
            <Film className="h-[26px] w-[26px] text-primary-foreground" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">
              No clips yet
            </h2>
            <p className="mt-1.5 text-[13px] leading-normal text-muted-foreground">
              Post a video from anywhere on Orbit and it lands here automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <div
        ref={scrollerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide bg-black"
      >
        {allClips.map((clip) => (
          <ClipPlayer
            key={clip.id}
            clip={clip}
            onNavigate={scrollByOne}
            isBestLoop={curatedIds.has(clip.id)}
          />
        ))}

        <div ref={sentinelRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="h-20 flex items-center justify-center bg-black">
            <Loader2 className="h-[22px] w-[22px] animate-spin text-white/60" />
          </div>
        )}
      </div>
    </div>
  );
}
