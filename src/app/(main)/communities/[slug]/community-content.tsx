"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Pin, Shield, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { OrbitErrorState } from "@/components/orbit/error-state";
import { PostCard } from "@/components/feed/post-card";
import { InlineComposer } from "@/components/feed/post-composer";
import { CommunityHeader } from "@/components/communities/community-header";
import { JoinRequestsPanel } from "@/components/communities/join-requests-panel";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getCommunityBySlug,
  getCommunityMembers,
  getCommunityPosts,
  checkMembership,
} from "@/lib/queries/communities";
import { checkUserInteractions, type PostWithAuthor } from "@/lib/queries/posts";

// No acceptance table exists, so first-post rules acknowledgement is a
// device-local flag keyed by user + room.
const rulesAcceptedKey = (userId: string, communityId: string) =>
  `room-rules-accepted:${userId}:${communityId}`;

// Compact duration for slowmode copy ("45s", "5m", "1h 30m").
function formatSlowmode(totalSeconds: number) {
  if (totalSeconds >= 3600) {
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return minutes > 0
      ? `${Math.floor(totalSeconds / 3600)}h ${minutes}m`
      : `${Math.floor(totalSeconds / 3600)}h`;
  }
  if (totalSeconds >= 60) {
    const seconds = totalSeconds % 60;
    return seconds > 0
      ? `${Math.floor(totalSeconds / 60)}m ${seconds}s`
      : `${Math.floor(totalSeconds / 60)}m`;
  }
  return `${totalSeconds}s`;
}

export function CommunityContent({ slug }: { slug: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: community,
    isLoading: loadingCommunity,
    isError: communityError,
    refetch: refetchCommunity,
  } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => getCommunityBySlug(slug),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["community-members", community?.id],
    queryFn: () => getCommunityMembers(community!.id, 5),
    enabled: !!community,
  });

  const { data: userRole = null, refetch: refetchRole } = useQuery({
    queryKey: ["community-membership", community?.id, user?.id],
    queryFn: () => checkMembership(community!.id, user!.id),
    enabled: !!community && !!user,
  });

  // Only members see the post list. Non-members (anon or signed-in but not
  // joined) get a join-to-read placeholder so the room's content stays
  // private until they're in.
  const isMemberQueryKey = userRole !== null;
  const {
    data: posts,
    isLoading: loadingPosts,
    isError: postsError,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: ["community-posts", community?.id],
    queryFn: () => getCommunityPosts(community!.id),
    enabled: !!community && isMemberQueryKey,
  });

  const { data: interactions } = useQuery({
    queryKey: ["community-post-interactions", user?.id, posts?.map((p: PostWithAuthor) => p.id)],
    queryFn: () =>
      checkUserInteractions(
        user!.id,
        posts!.map((p: PostWithAuthor) => p.id)
      ),
    enabled: !!user && !!posts && posts.length > 0,
  });

  const communityRules = community?.rules ?? [];
  const [rulesAccepted, setRulesAccepted] = useState(false);
  useEffect(() => {
    if (!user || !community) return;
    setRulesAccepted(
      window.localStorage.getItem(rulesAcceptedKey(user.id, community.id)) === "1"
    );
  }, [user, community]);

  const acceptRules = () => {
    if (!user || !community) return;
    window.localStorage.setItem(rulesAcceptedKey(user.id, community.id), "1");
    setRulesAccepted(true);
  };

  // Client-side slowmode v1: the member's most recent top-level post in this
  // room comes from the loaded list (the compose dialog invalidates
  // community-posts on send, so a fresh post lands here right away). Owners
  // and moderators are exempt, standard slowmode semantics.
  const slowmodeSeconds = community?.slowmode_seconds ?? 0;
  const slowmodeExempt =
    userRole === "owner" ||
    userRole === "moderator" ||
    (!!user && community?.created_by === user.id);
  const lastOwnPostAt = useMemo(() => {
    if (!user || !posts) return 0;
    return posts.reduce(
      (latest: number, p: PostWithAuthor) =>
        p.user_id === user.id
          ? Math.max(latest, new Date(p.created_at).getTime())
          : latest,
      0
    );
  }, [user, posts]);
  const slowmodeUntil =
    slowmodeSeconds > 0 && !slowmodeExempt && lastOwnPostAt > 0
      ? lastOwnPostAt + slowmodeSeconds * 1000
      : 0;
  // The countdown lives in state and is only written from timer callbacks:
  // render stays pure (no Date.now during render) and the effect body never
  // calls setState synchronously, which the react-hooks lint rules require.
  // The zero-delay leading tick seeds the value when the window opens.
  const [slowmodeRemaining, setSlowmodeRemaining] = useState(0);
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((slowmodeUntil - Date.now()) / 1000)
      );
      setSlowmodeRemaining(remaining);
      return remaining;
    };
    const seed = setTimeout(tick, 0);
    const id = setInterval(() => {
      if (tick() <= 0) clearInterval(id);
    }, 1000);
    return () => {
      clearTimeout(seed);
      clearInterval(id);
    };
  }, [slowmodeUntil]);

  const handleMembershipChange = () => {
    refetchRole();
    queryClient.invalidateQueries({ queryKey: ["community", slug] });
    queryClient.invalidateQueries({ queryKey: ["community-members", community?.id] });
  };

  if (loadingCommunity) {
    return (
      <div className="border-x border-border min-h-screen">
        <Skeleton className="h-48 w-full" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-24 w-24 rounded-full -mt-12" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (communityError) {
    return (
      <div className="border-x border-border min-h-screen">
        <OrbitErrorState
          headline="Couldn't load this"
          accentWord="room"
          sub="Something went wrong fetching this community."
          onRetry={() => refetchCommunity()}
        />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="border-x border-border min-h-screen">
        <EmptyState
          title="Community not found"
          description="This community may have been removed or doesn't exist."
        />
      </div>
    );
  }

  const isMember = userRole !== null;
  const isOwnerOrMod =
    userRole === "owner" ||
    userRole === "moderator" ||
    (!!user && community.created_by === user.id);
  const policy = community.join_policy ?? "public";

  return (
    <div className="border-x border-border min-h-screen">
      <CommunityHeader
        community={community}
        members={members}
        userRole={userRole}
        onMembershipChange={handleMembershipChange}
      />

      {/* Pending join requests, owners/mods only, only on approval rooms */}
      {isOwnerOrMod && policy === "approval" && (
        <JoinRequestsPanel
          communityId={community.id}
          communitySlug={community.slug}
        />
      )}

      {/* Post composer for members. Rooms with rules gate the first post
          behind a one-time acknowledgement stored on this device. */}
      {isMember && user && (
        <div className="border-b border-border p-4">
          {communityRules.length > 0 && !rulesAccepted ? (
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-primary" />
                <span>Before you post, agree to the room rules</span>
              </div>
              <div className="mt-3 space-y-2">
                {communityRules.map((rule, i) => (
                  <div key={i} className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium">
                      {i + 1}. {rule.title}
                    </p>
                    {rule.description && (
                      <p className="text-muted-foreground mt-0.5">
                        {rule.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <Button className="mt-3" size="sm" onClick={acceptRules}>
                Accept and post
              </Button>
            </div>
          ) : slowmodeRemaining > 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-[18px] text-sm text-muted-foreground">
              <Timer className="h-4 w-4 text-primary" />
              <span>Slowmode: {formatSlowmode(slowmodeRemaining)}</span>
            </div>
          ) : (
            <InlineComposer
              communityId={community.id}
              onSuccess={() => refetchPosts()}
            />
          )}
          {slowmodeSeconds > 0 && !slowmodeExempt && (
            <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>
                Slowmode is on: one post every {formatSlowmode(slowmodeSeconds)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Community feed, gated on membership. Non-members see a locked
          placeholder; the actual post list never hits the wire for them. */}
      <div>
        {!isMember ? (
          <EmptyState
            icon={MessageSquare}
            title="This room is for members"
            description={
              policy === "approval"
                ? "Request to join to see posts and conversation."
                : "Join this room to see posts and conversation."
            }
          />
        ) : loadingPosts ? (
          <div className="p-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : postsError ? (
          <OrbitErrorState
            headline="Couldn't load"
            accentWord="posts"
            sub="Something went wrong fetching this room's posts."
            onRetry={() => refetchPosts()}
          />
        ) : posts && posts.length > 0 ? (
          posts.map((post: PostWithAuthor) => (
            <div key={post.id}>
              {post.is_pinned && (
                <div className="flex items-center gap-1.5 px-5 pt-3 font-mono text-[10.5px] tracking-[0.1em] text-primary">
                  <Pin className="h-3 w-3" />
                  <span>PINNED</span>
                </div>
              )}
              <PostCard
                post={post}
                isLiked={interactions?.likedPostIds?.has(post.id)}
                isBookmarked={interactions?.bookmarkedPostIds?.has(post.id)}
                communityRole={userRole}
                onUpdate={() => refetchPosts()}
              />
            </div>
          ))
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="No posts yet"
            description="Be the first to post in this community!"
          />
        )}
      </div>
    </div>
  );
}
