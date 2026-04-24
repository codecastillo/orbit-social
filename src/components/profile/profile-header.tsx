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
    <div className="relative">
      {/* Cover Photo */}
      <div className="h-60 sm:h-72 bg-gradient-to-br from-primary/40 via-violet-600/25 to-primary/10 relative overflow-hidden">
        {profile.cover_url && (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
        {/* Dramatic multi-layer gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" />
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="px-5 sm:px-7 pb-6 relative">
        {/* Avatar + Actions Row */}
        <div className="flex justify-between items-end -mt-20 relative z-10">
          <div className="relative">
            <div className="rounded-full p-1 bg-background shadow-2xl shadow-black/30">
              <UserAvatar
                src={profile.avatar_url}
                fallback={profile.display_name}
                size="xl"
                className="h-32 w-32 ring-0 border-0"
              />
            </div>
            {profile.is_verified && (
              <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background flex items-center justify-center">
                <BadgeCheck className="h-6 w-6 text-primary fill-primary/20" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 pb-2">
            {isOwnProfile ? (
              <Button
                variant="outline"
                className="rounded-full px-6 h-10 font-semibold border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] transition-all"
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
                      className="rounded-full h-10 w-10 border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08]"
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
        <div className="mt-5 space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {profile.display_name}
            </h1>
          </div>
          <p className="text-muted-foreground text-[15px]">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-4 text-[15px] leading-relaxed max-w-lg">{profile.bio}</p>
        )}

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm text-muted-foreground">
          {profile.location && (
            <span className="flex items-center gap-1.5">
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
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  {url.hostname}
                </a>
              );
            } catch {
              return null;
            }
          })()}
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Joined{" "}
            {new Date(profile.created_at).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Stats - Prominent cards */}
        <div className="flex gap-3 mt-6">
          <button className="flex flex-col items-center px-5 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group min-w-[90px]">
            <span className="text-xl font-bold tracking-tight">{formatNumber(profile.post_count)}</span>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors mt-0.5">Posts</span>
          </button>
          <button className="flex flex-col items-center px-5 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group min-w-[90px]">
            <span className="text-xl font-bold tracking-tight">{formatNumber(profile.follower_count)}</span>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors mt-0.5">Followers</span>
          </button>
          <button className="flex flex-col items-center px-5 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group min-w-[90px]">
            <span className="text-xl font-bold tracking-tight">{formatNumber(profile.following_count)}</span>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors mt-0.5">Following</span>
          </button>
        </div>
      </div>
    </div>
  );
}
