"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { useAuth } from "@/lib/hooks/use-auth";
import { followUser, unfollowUser, type ProfileSummary } from "@/lib/queries/social";
import { useState } from "react";
import { toast } from "sonner";

interface UserSuggestionCardProps {
  profile: ProfileSummary;
  initialIsFollowing?: boolean;
  className?: string;
}

export function UserSuggestionCard({
  profile,
  initialIsFollowing = false,
  className,
}: UserSuggestionCardProps) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const isOwnProfile = user?.id === profile.id;

  const handleToggleFollow = async () => {
    if (!user) {
      toast.error("Sign in to follow people");
      return;
    }

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    try {
      if (wasFollowing) {
        await unfollowUser(user.id, profile.id);
      } else {
        await followUser(user.id, profile.id);
      }
    } catch {
      setIsFollowing(wasFollowing);
      toast.error("Something went wrong");
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors",
        className
      )}
    >
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
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {profile.bio}
          </p>
        )}
      </div>

      {!isOwnProfile && (
        <FollowButton
          isFollowing={isFollowing}
          onToggle={handleToggleFollow}
          size="sm"
        />
      )}
    </div>
  );
}
