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
      {/* Cover Photo — full-bleed with dramatic 3-layer gradient overlay */}
      <div className="h-60 sm:h-72 bg-gradient-to-br from-violet-600/50 via-primary/30 to-cyan-500/20 relative overflow-hidden">
        {profile.cover_url && (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
        {/* Layer 1: dark from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        {/* Layer 2: dark from top corners */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-transparent" />
        {/* Layer 3: heavy bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="px-5 sm:px-7 pb-6 relative">
        {/* Avatar + Actions Row */}
        <div className="flex justify-between items-end -mt-16 relative z-10">
          {/* Avatar with animated gradient ring */}
          <div className="relative">
            <div className="rounded-full p-[3px] bg-gradient-to-tr from-violet-500 via-primary to-cyan-400 shadow-2xl shadow-violet-500/20 animate-[spin_6s_linear_infinite]">
              <div className="rounded-full p-[3px] bg-background">
                <UserAvatar
                  src={profile.avatar_url}
                  fallback={profile.display_name}
                  size="xl"
                  className="h-28 w-28 ring-0 border-4 border-background"
                />
              </div>
            </div>
            {profile.is_verified && (
              <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background flex items-center justify-center shadow-lg">
                <BadgeCheck className="h-6 w-6 text-primary fill-primary/20" />
              </div>
            )}
          </div>

          {/* Action buttons — frosted glass style */}
          <div className="flex items-center gap-2.5 pb-2">
            {isOwnProfile ? (
              <Button
                variant="outline"
                className="rounded-full px-6 h-10 font-semibold border-white/[0.12] bg-white/[0.06] backdrop-blur-xl hover:bg-white/[0.10] transition-all shadow-lg shadow-black/10"
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
                      className="rounded-full h-10 w-10 border-white/[0.12] bg-white/[0.06] backdrop-blur-xl hover:bg-white/[0.10] shadow-lg shadow-black/10"
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
            <h1 className="text-2xl font-extrabold tracking-tight">
              {profile.display_name}
            </h1>
          </div>
          <p className="text-muted-foreground text-[15px]">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-4 text-[15px] leading-relaxed max-w-lg">
            {profile.bio}
          </p>
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

        {/* Stats — glowing metric cards */}
        <div className="flex gap-3 mt-6">
          {[
            { value: profile.post_count, label: "Posts" },
            { value: profile.follower_count, label: "Followers" },
            { value: profile.following_count, label: "Following" },
          ].map((stat) => (
            <button
              key={stat.label}
              className="flex flex-col items-center bg-white/[0.04] rounded-xl px-4 py-2 hover:bg-white/[0.08] transition-all group min-w-[85px] border border-white/[0.06] shadow-sm shadow-primary/5"
            >
              <span className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                {formatNumber(stat.value)}
              </span>
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground/70 transition-colors mt-0.5 uppercase tracking-wide font-medium">
                {stat.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
