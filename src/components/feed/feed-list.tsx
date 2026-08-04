"use client";

import { useRef, useCallback, useMemo, useState } from "react";
import { ArrowUp, Loader2, UserPlus, Compass } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PostCard } from "./post-card";
import { EmptyState } from "@/components/shared/empty-state";
import { FeedSkeleton } from "@/components/shared/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { Button } from "@/components/ui/button";
import { useFeed } from "@/lib/hooks/use-feed";
import { useNewPosts } from "@/lib/hooks/use-new-posts";
import { useAuth } from "@/lib/hooks/use-auth";
import type { UserInteractions } from "@/lib/services/feed-algorithm";
import { getSuggestedUsers, type ProfileSummary } from "@/lib/queries/social";
import { toggleFollowState, type FollowState } from "@/lib/queries/social";
import { toast } from "sonner";

interface FeedListProps {
  tab: "foryou" | "following";
}

export function FeedList({ tab }: FeedListProps) {
  const { user } = useAuth();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useFeed(tab);

  // Stable identity so memoized PostCards don't re-render on every list pass.
  const handlePostUpdate = useCallback(() => {
    refetch();
  }, [refetch]);

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

  // Build interaction map for future per-user features. Currently unused
  // because both tabs render strictly chronological, the heuristic
  // ranking algorithm is intentionally disabled until Phase 2.
  const _interactionMap: UserInteractions = useMemo(() => {
    const map = new Map<string, number>();
    if (!data?.pages) return map;
    for (const page of data.pages) {
      for (const post of page.posts) {
        if (post.user_has_liked) {
          map.set(post.user_id, (map.get(post.user_id) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [data]);

  // Both tabs render strictly chronologically (newest first). The server
  // already orders by created_at desc, so we just need to flatten +
  // strip replies. Authors of pinned posts pin via their profile. Muted
  // words and not-interested feedback are already filtered inside useFeed.
  const allPosts = useMemo(() => {
    return (data?.pages.flatMap((page) => page.posts) || [])
      .filter((p) => !p.reply_to_id);
  }, [data]);

  // The newest post anywhere in the loaded pages, not the top card: For You
  // is ranked, so the first card is usually older than the most recent post,
  // and comparing against it would claim new posts on nearly every check.
  const newestLoadedAt = useMemo(() => {
    let newest: string | null = null;
    for (const post of allPosts) {
      if (!newest || post.created_at > newest) newest = post.created_at;
    }
    return newest;
  }, [allPosts]);

  const hasNewPosts = useNewPosts(tab, newestLoadedAt);

  if (isLoading) return <FeedSkeleton />;

  if (isError) {
    return (
      <EmptyState
        title="Couldn't load posts"
        description="Something went wrong. Try again."
        action={
          <button onClick={() => refetch()} className="text-primary text-sm font-medium hover:underline">
            Retry
          </button>
        }
      />
    );
  }

  if (allPosts.length === 0) {
    return <EmptyFeedWithSuggestions tab={tab} userId={user?.id} />;
  }

  return (
    <div className="space-y-0">
      {hasNewPosts && (
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            refetch();
          }}
          className="fixed left-1/2 top-20 z-40 flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-lg shadow-black/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          New posts
        </button>
      )}

      {allPosts.map((post, index) => (
        <div key={post.id}>
          <PostCard
            post={post}
            isLiked={post.user_has_liked}
            isBookmarked={post.user_has_bookmarked}
            isReposted={post.user_has_reposted}
            onUpdate={handlePostUpdate}
            allUserPosts={allPosts}
            surface={tab}
          />
          {index < allPosts.length - 1 && (
            <div className="mx-5 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          )}
        </div>
      ))}

      <div ref={loadMoreRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!hasNextPage && !isFetchingNextPage && (
        <div className="flex items-center gap-3 px-5 py-8">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
          <span className="text-xs text-muted-foreground">
            You&apos;re all caught up
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
        </div>
      )}
    </div>
  );
}

function EmptyFeedWithSuggestions({ tab, userId }: { tab: string; userId?: string }) {
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["feed-suggestions", userId],
    queryFn: () => getSuggestedUsers(userId!, 12),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="py-8 px-4">
      <div className="text-center mb-8">
        <div className="h-16 w-16 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-4">
          <UserPlus className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <h3 className="text-lg font-bold">
          {tab === "following" ? "No posts yet" : "Welcome to Orbit"}
        </h3>
        <p className="text-sm text-muted-foreground/60 mt-1.5 max-w-xs mx-auto">
          {tab === "following"
            ? "Follow people to see their posts here."
            : "Follow some people to get started. Your feed will fill up with their posts."}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
          ))}
        </div>
      ) : suggestions.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Suggested for you
          </h4>
          <div className="space-y-2">
            {suggestions.map((profile) => (
              <SuggestionCard key={profile.id} profile={profile} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8 text-center">
        <Link href="/explore">
          <Button variant="outline" className="rounded-xl h-10 px-6 font-semibold cursor-pointer">
            <Compass className="h-4 w-4 mr-2" />
            Explore Content
          </Button>
        </Link>
      </div>
    </div>
  );
}

function SuggestionCard({ profile }: { profile: ProfileSummary }) {
  const [followState, setFollowState] = useState<FollowState>("none");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleFollow = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const next = await toggleFollowState(user.id, profile.id, followState);
      setFollowState(next);
      if (next === "following") toast.success(`Following @${profile.username}`);
      if (next === "requested") toast.success(`Requested to follow @${profile.username}`);
    } catch {
      toast.error("Couldn't update follow");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border hover:bg-surface-elevated transition-colors">
      <Link href={`/${profile.username}`}>
        <UserAvatar src={profile.avatar_url} fallback={profile.display_name || "U"} size="md" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/${profile.username}`} className="hover:underline">
          <p className="text-sm font-semibold truncate">{profile.display_name}</p>
        </Link>
        <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
        {profile.bio && (
          <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{profile.bio}</p>
        )}
      </div>
      <Button
        variant={followState === "none" ? "default" : "outline"}
        size="sm"
        className="rounded-xl h-9 px-4 font-semibold cursor-pointer shrink-0"
        onClick={handleFollow}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : followState === "following" ? (
          "Following"
        ) : followState === "requested" ? (
          "Requested"
        ) : (
          "Follow"
        )}
      </Button>
    </div>
  );
}
