"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getFollowers,
  followUser,
  unfollowUser,
  checkFollowing,
  type ProfileSummary,
} from "@/lib/queries/social";
import { toast } from "sonner";

interface Props {
  params: Promise<{ username: string }>;
}

export default function FollowersPage({ params }: Props) {
  const { username } = use(params);
  const { user } = useAuth();

  const { data: followers, isLoading } = useQuery({
    queryKey: ["followers", username],
    queryFn: async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // First resolve username to user id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .single();

      if (!profile) throw new Error("User not found");

      return getFollowers(profile.id);
    },
  });

  // Check which followers the current user follows
  const followerIds = followers?.map((f) => f.id) ?? [];
  const { data: followingSet } = useQuery({
    queryKey: ["check-following", user?.id, followerIds],
    queryFn: () => checkFollowing(user!.id, followerIds),
    enabled: !!user?.id && followerIds.length > 0,
  });

  return (
    <div className="border-x border-border min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Link
            href={`/${username}`}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg leading-tight">Followers</h1>
            <p className="text-xs text-muted-foreground">@{username}</p>
          </div>
        </div>
      </div>

      {/* Followers list */}
      {isLoading ? (
        <FollowerListSkeleton />
      ) : !followers || followers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No followers yet"
          description="When someone follows this account, they'll show up here."
        />
      ) : (
        <div>
          {followers.map((profile) => (
            <FollowerItem
              key={profile.id}
              profile={profile}
              isFollowing={followingSet?.has(profile.id) ?? false}
              currentUserId={user?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FollowerItem({
  profile,
  isFollowing: initialIsFollowing,
  currentUserId,
}: {
  profile: ProfileSummary;
  isFollowing: boolean;
  currentUserId?: string;
}) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const isOwnProfile = currentUserId === profile.id;

  const handleToggle = useCallback(async () => {
    if (!currentUserId) {
      toast.error("Sign in to follow people");
      return;
    }
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    try {
      if (wasFollowing) {
        await unfollowUser(currentUserId, profile.id);
      } else {
        await followUser(currentUserId, profile.id);
      }
    } catch {
      setIsFollowing(wasFollowing);
      toast.error("Something went wrong");
    }
  }, [currentUserId, isFollowing, profile.id]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
      <Link href={`/${profile.username}`} className="shrink-0">
        <UserAvatar
          src={profile.avatar_url}
          fallback={profile.display_name}
          size="md"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/${profile.username}`} className="block">
          <p className="font-semibold text-sm truncate hover:underline">
            {profile.display_name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            @{profile.username}
          </p>
        </Link>
        {profile.bio && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {profile.bio}
          </p>
        )}
      </div>

      {!isOwnProfile && (
        <FollowButton
          isFollowing={isFollowing}
          onToggle={handleToggle}
          size="sm"
        />
      )}
    </div>
  );
}

function FollowerListSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-[100px] rounded-full" />
        </div>
      ))}
    </div>
  );
}
