"use client";

import { useRef, useCallback, useMemo, useEffect, useState } from "react";
import { Loader2, UserPlus, Compass } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PostCard } from "./post-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { Button } from "@/components/ui/button";
import { useFeed } from "@/lib/hooks/use-feed";
import { useAuth } from "@/lib/hooks/use-auth";
import { rankPosts, type UserInteractions } from "@/lib/services/feed-algorithm";
import { useFilterStore } from "@/lib/stores/filter-store";
import { getSuggestedUsers } from "@/lib/queries/social";
import { followUser, unfollowUser } from "@/lib/queries/social";
import { toast } from "sonner";

interface FeedListProps {
  tab: "foryou" | "following";
}

export function FeedList({ tab }: FeedListProps) {
  const { user } = useAuth();
  const { containsBlockedWord, loadFromStorage } = useFilterStore();

  // Load blocked words from localStorage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

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

  // Build interaction map from liked posts in the current feed data
  const interactionMap: UserInteractions = useMemo(() => {
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

  // Client-side ranking for the "For You" tab
  const rankedPosts = useMemo(() => {
    // Filter out replies — only show top-level posts in feed
    const raw = (data?.pages.flatMap((page) => page.posts) || [])
      .filter((p) => !p.reply_to_id);
    if (tab === "foryou" && user?.id && raw.length > 1) {
      return rankPosts(raw, user.id, interactionMap);
    }
    return raw;
  }, [data, tab, user?.id, interactionMap]);

  // Filter out posts containing blocked words
  const allPosts = useMemo(() => {
    return rankedPosts.filter(
      (post) => !containsBlockedWord(post.content || "")
    );
  }, [rankedPosts, containsBlockedWord]);

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

  if (allPosts.length === 0) {
    return <EmptyFeedWithSuggestions tab={tab} userId={user?.id} />;
  }

  return (
    <div className="space-y-0">
      {allPosts.map((post, index) => (
        <div key={post.id}>
          <PostCard
            post={post}
            isLiked={post.user_has_liked}
            isBookmarked={post.user_has_bookmarked}
            isReposted={post.user_has_reposted}
            onUpdate={() => refetch()}
            allUserPosts={allPosts}
          />
          {index < allPosts.length - 1 && (
            <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          )}
        </div>
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
    <div className="space-y-0">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-5 space-y-3">
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
        <div className="h-16 w-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
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
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]">
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
            {suggestions.map((profile: any) => (
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

function SuggestionCard({ profile }: { profile: any }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleFollow = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (following) {
        await unfollowUser(user.id, profile.id);
        setFollowing(false);
      } else {
        await followUser(user.id, profile.id);
        setFollowing(true);
        toast.success(`Following @${profile.username}`);
      }
    } catch {
      toast.error("Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
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
        variant={following ? "outline" : "default"}
        size="sm"
        className="rounded-xl h-9 px-4 font-semibold cursor-pointer shrink-0"
        onClick={handleFollow}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : following ? "Following" : "Follow"}
      </Button>
    </div>
  );
}
