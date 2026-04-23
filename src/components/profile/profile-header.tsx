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
      <div className="h-48 bg-gradient-to-br from-primary/20 to-primary/5 relative">
        {profile.cover_url && (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="px-4 pb-4">
        {/* Avatar and Actions Row */}
        <div className="flex justify-between items-start -mt-12">
          <UserAvatar
            src={profile.avatar_url}
            fallback={profile.display_name}
            size="xl"
            className="border-4 border-background"
          />

          <div className="flex items-center gap-2 mt-14">
            {isOwnProfile ? (
              <Button
                variant="outline"
                className="rounded-full"
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
                      className="rounded-full"
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
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-1">
            <h1 className="text-xl font-bold">{profile.display_name}</h1>
            {profile.is_verified && (
              <BadgeCheck className="h-5 w-5 text-primary fill-primary/20" />
            )}
          </div>
          <p className="text-muted-foreground">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && <p className="mt-3 text-sm leading-relaxed">{profile.bio}</p>}

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-muted-foreground">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
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
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  {url.hostname}
                </a>
              );
            } catch {
              return null;
            }
          })()}
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            Joined{" "}
            {new Date(profile.created_at).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-3">
          <button className="text-sm hover:underline">
            <span className="font-bold">{formatNumber(profile.following_count)}</span>{" "}
            <span className="text-muted-foreground">Following</span>
          </button>
          <button className="text-sm hover:underline">
            <span className="font-bold">{formatNumber(profile.follower_count)}</span>{" "}
            <span className="text-muted-foreground">Followers</span>
          </button>
        </div>
      </div>
    </div>
  );
}
