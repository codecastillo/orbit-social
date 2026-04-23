"use client";

import { useState } from "react";
import {
  CalendarDays,
  Link as LinkIcon,
  MapPin,
  MoreHorizontal,
  BadgeCheck,
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
    <div>
      {/* Cover Photo */}
      <div className="h-56 sm:h-64 bg-gradient-to-br from-primary/30 via-primary/15 to-primary/5 relative">
        {profile.cover_url && (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
        {/* Gradient overlay at bottom for smooth avatar transition */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/80 to-transparent" />
      </div>

      <div className="px-4 sm:px-6 pb-5">
        {/* Avatar and Actions Row */}
        <div className="flex justify-between items-end -mt-16 relative">
          <UserAvatar
            src={profile.avatar_url}
            fallback={profile.display_name}
            size="xl"
            className="h-32 w-32 border-[5px] border-background shadow-lg ring-0"
          />

          <div className="flex items-center gap-2 pb-1">
            {isOwnProfile ? (
              <Button
                variant="outline"
                className="rounded-full px-5 font-semibold"
                onClick={onEdit}
              >
                Edit Profile
              </Button>
            ) : (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-10 w-10"
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
                <FollowButton
                  isFollowing={isFollowing}
                  onToggle={onFollow}
                />
              </>
            )}
          </div>
        </div>

        {/* Name and Username */}
        <div className="mt-4 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight">
              {profile.display_name}
            </h1>
            {profile.is_verified && (
              <BadgeCheck className="h-6 w-6 text-primary fill-primary/20" />
            )}
          </div>
          <p className="text-muted-foreground text-[15px]">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-3 text-[15px] leading-relaxed">{profile.bio}</p>
        )}

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3.5 text-sm text-muted-foreground">
          {profile.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {profile.location}
            </span>
          )}
          {profile.website && (() => {
            try {
              const url = new URL(profile.website);
              if (url.protocol !== "http:" && url.protocol !== "https:") return null;
              return (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <LinkIcon className="h-4 w-4" />
                  {url.hostname}
                </a>
              );
            } catch {
              return null;
            }
          })()}
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Joined{" "}
            {new Date(profile.created_at).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Stats */}
        <div className="flex gap-5 mt-4">
          <button className="group text-sm hover:underline">
            <span className="font-bold text-base">{formatNumber(profile.following_count)}</span>{" "}
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">Following</span>
          </button>
          <button className="group text-sm hover:underline">
            <span className="font-bold text-base">{formatNumber(profile.follower_count)}</span>{" "}
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">Followers</span>
          </button>
        </div>
      </div>
    </div>
  );
}
