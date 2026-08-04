"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Lock, MoreHorizontal, UserMinus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/orbit/confirm-dialog";
import {
  REMOVE_FOLLOWER_DESCRIPTION,
  removeFollowerTitle,
} from "@/components/profile/remove-follower-copy";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getFollowers,
  checkFollowing,
  checkFollowStates,
  removeFollower,
  toggleFollowState,
  FOLLOWER_INVALIDATION_KEYS,
  type FollowState,
  type ProfileSummary,
} from "@/lib/queries/social";
import {
  BLOCKED_FOLLOW_MESSAGE,
  isBlockedFollowError,
} from "@/lib/utils/blocked-error";
import { toast } from "sonner";
import { OrbitErrorState } from "@/components/orbit/error-state";

interface Props {
  params: Promise<{ username: string }>;
}

interface ProfileMeta {
  id: string;
  is_private: boolean | null;
  private_followers: boolean | null;
}

export default function FollowersPage({ params }: Props) {
  const { username } = use(params);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<ProfileSummary | null>(null);

  const {
    data: profileMeta,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["profile-meta", username],
    queryFn: async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, is_private, private_followers")
        .eq("username", username)
        .single();
      if (error) throw error;
      return data as ProfileMeta;
    },
  });

  const isOwnProfile = !!user && !!profileMeta && user.id === profileMeta.id;

  const { data: viewerFollows } = useQuery({
    queryKey: ["viewer-follows", user?.id, profileMeta?.id],
    queryFn: async () => {
      if (!user || !profileMeta) return false;
      const set = await checkFollowing(user.id, [profileMeta.id]);
      return set.has(profileMeta.id);
    },
    enabled: !!user?.id && !!profileMeta?.id && !isOwnProfile,
  });

  const isLocked =
    !!profileMeta &&
    !isOwnProfile &&
    (profileMeta.private_followers === true ||
      (profileMeta.is_private === true && viewerFollows !== true));

  const { data: followers, isLoading, isError, refetch } = useQuery({
    queryKey: ["followers", username],
    queryFn: () => getFollowers(profileMeta!.id),
    enabled: !!profileMeta?.id && !isLocked,
  });

  const followerIds = followers?.map((f) => f.id) ?? [];
  const { data: followStates } = useQuery({
    queryKey: ["follow-states", user?.id, followerIds],
    queryFn: () => checkFollowStates(user!.id, followerIds),
    enabled: !!user?.id && followerIds.length > 0,
  });

  const listKey = ["followers", username];

  const handleRemoveFollower = async (profile: ProfileSummary) => {
    const previous = queryClient.getQueryData<ProfileSummary[]>(listKey);
    queryClient.setQueryData<ProfileSummary[]>(listKey, (list) =>
      list?.filter((p) => p.id !== profile.id)
    );
    try {
      await removeFollower(profile.id);
      // The follow triggers maintain follower_count, so the counts behind
      // these keys shift with the row.
      for (const queryKey of FOLLOWER_INVALIDATION_KEYS) {
        queryClient.invalidateQueries({ queryKey });
      }
      toast.success(`Removed @${profile.username}`);
    } catch (err) {
      console.error("removeFollower failed", err);
      queryClient.setQueryData(listKey, previous);
      toast.error(`Couldn't remove @${profile.username}`);
    }
  };

  return (
    <div className="border-x border-border min-h-screen">
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

      {profileLoading ? (
        <FollowerListSkeleton />
      ) : profileError || isError ? (
        <OrbitErrorState
          headline="Couldn't load"
          accentWord="followers"
          sub="Something went wrong fetching this list."
          onRetry={() => (profileError ? refetchProfile() : refetch())}
        />
      ) : isLocked ? (
        <PrivateLock username={username} />
      ) : isLoading ? (
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
              followState={followStates?.get(profile.id) ?? "none"}
              currentUserId={user?.id}
              onRemove={isOwnProfile ? () => setRemoveTarget(profile) : undefined}
            />
          ))}
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setRemoveTarget(null);
          }}
          title={removeFollowerTitle(removeTarget.username)}
          description={REMOVE_FOLLOWER_DESCRIPTION}
          confirmLabel="Remove"
          danger
          onConfirm={() => handleRemoveFollower(removeTarget)}
        />
      )}
    </div>
  );
}

function PrivateLock({ username }: { username: string }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-16 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-muted/40 border border-border flex items-center justify-center">
        <Lock className="h-5 w-5 text-muted-foreground" strokeWidth={1.6} />
      </div>
      <p className="font-semibold">This account is private.</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Follow @{username} to see who follows them.
      </p>
    </div>
  );
}

function FollowerItem({
  profile,
  followState,
  currentUserId,
  onRemove,
}: {
  profile: ProfileSummary;
  followState: FollowState;
  currentUserId?: string;
  /** Present only on your own followers list. */
  onRemove?: () => void;
}) {
  // Local overlay so a toggle shows immediately without refetching the list,
  // while the fetched state still wins until the viewer touches the row.
  const [override, setOverride] = useState<FollowState | null>(null);
  const state = override ?? followState;
  const isOwnProfile = currentUserId === profile.id;

  const handleToggle = useCallback(async () => {
    if (!currentUserId) {
      toast.error("Sign in to follow people");
      return;
    }
    try {
      setOverride(await toggleFollowState(currentUserId, profile.id, state));
    } catch (err) {
      toast.error(
        isBlockedFollowError(err)
          ? BLOCKED_FOLLOW_MESSAGE
          : "Couldn't update follow"
      );
    }
  }, [currentUserId, state, profile.id]);

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
          state={state}
          onToggle={handleToggle}
          size="sm"
        />
      )}

      {onRemove && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`More options for @${profile.username}`}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-2xl">
            <DropdownMenuItem
              className="cursor-pointer rounded-lg text-destructive focus:text-destructive"
              onClick={onRemove}
            >
              <UserMinus className="mr-2 h-4 w-4" />
              Remove follower
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
