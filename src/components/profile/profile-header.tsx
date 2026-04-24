"use client";

import {
  Link as LinkIcon,
  MoreHorizontal,
  BadgeCheck,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { formatNumber } from "@/lib/utils/format";

interface ProfileHeaderProps {
  profile: {
    id: string;
    username: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    website: string | null;
    location: string | null;
    is_verified: boolean;
    follower_count: number;
    following_count: number;
    post_count: number;
    created_at: string;
  };
  isOwnProfile: boolean;
  isFollowing: boolean;
  onFollow: () => Promise<void>;
  onEdit?: () => void;
}

export function ProfileHeader({
  profile,
  isOwnProfile,
  isFollowing,
  onFollow,
  onEdit,
}: ProfileHeaderProps) {
  return (
    <div className="px-5 sm:px-7 pt-6 pb-4">
      {/* Row 1: Avatar + Stats */}
      <div className="flex items-center gap-6 sm:gap-10">
        {/* Avatar */}
        <div className="shrink-0">
          <UserAvatar
            src={profile.avatar_url}
            fallback={profile.display_name}
            size="xl"
            className="h-20 w-20 sm:h-24 sm:w-24"
          />
        </div>

        {/* Stats */}
        <div className="flex flex-1 justify-around">
          {[
            { value: profile.post_count, label: "Posts" },
            { value: profile.follower_count, label: "Followers" },
            { value: profile.following_count, label: "Following" },
          ].map((stat) => (
            <button
              key={stat.label}
              className="flex flex-col items-center gap-0.5"
            >
              <span className="text-lg font-bold leading-tight">
                {formatNumber(stat.value)}
              </span>
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: Display name + verified */}
      <div className="mt-4 flex items-center gap-1.5">
        <h1 className="text-sm font-bold leading-tight">
          {profile.display_name}
        </h1>
        {profile.is_verified && (
          <BadgeCheck className="h-4 w-4 text-primary fill-primary/20" />
        )}
      </div>

      {/* Row 2b: Username */}
      <p className="text-sm text-muted-foreground">@{profile.username}</p>

      {/* Row 3: Bio */}
      {profile.bio && (
        <p className="mt-1 text-sm leading-snug">{profile.bio}</p>
      )}

      {/* Row 4: Website */}
      {profile.website &&
        (() => {
          try {
            const url = new URL(profile.website);
            if (url.protocol !== "http:" && url.protocol !== "https:")
              return null;
            return (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                {url.hostname}
              </a>
            );
          } catch {
            return null;
          }
        })()}

      {/* Row 5: Action buttons */}
      <div className="mt-4 flex items-center gap-2">
        {isOwnProfile ? (
          <Button
            variant="outline"
            className="flex-1 rounded-lg h-9 text-sm font-semibold"
            onClick={onEdit}
          >
            Edit Profile
          </Button>
        ) : (
          <>
            <FollowButton
              isFollowing={isFollowing}
              onToggle={onFollow}
              className="flex-1 rounded-lg h-9"
            />
            <Button
              variant="outline"
              className="flex-1 rounded-lg h-9 text-sm font-semibold"
            >
              <MessageCircle className="h-4 w-4 mr-1.5" />
              Message
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-lg h-9 w-9"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Block</DropdownMenuItem>
                <DropdownMenuItem>Mute</DropdownMenuItem>
                <DropdownMenuItem>Report</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
