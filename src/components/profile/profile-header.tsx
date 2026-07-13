"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Link as LinkIcon,
  MoreHorizontal,
  BadgeCheck,
  MessageCircle,
  CalendarDays,
  QrCode,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar, type AvatarBorderStyle } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { QRCodeDialog } from "@/components/profile/qr-code-dialog";
import { formatNumber } from "@/lib/utils/format";
import { useAuth } from "@/lib/hooks/use-auth";
import { getMutualFollows } from "@/lib/queries/social";

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
    theme_color?: string | null;
    avatar_border?: string | null;
  };
  isOwnProfile: boolean;
  isFollowing: boolean;
  onFollow: () => Promise<void>;
  onEdit?: () => void;
}

function formatJoinDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `Joined ${date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

export function ProfileHeader({
  profile,
  isOwnProfile,
  isFollowing,
  onFollow,
  onEdit,
}: ProfileHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [qrOpen, setQrOpen] = useState(false);

  const themeColor = profile.theme_color || undefined;
  const avatarBorder = (profile.avatar_border as AvatarBorderStyle) || "none";

  // Build inline accent style object when theme_color is set
  const accentStyle = themeColor
    ? ({ "--profile-accent": themeColor } as React.CSSProperties)
    : undefined;

  const { data: mutualFollows } = useQuery({
    queryKey: ["mutual-follows", user?.id, profile.id],
    queryFn: () => getMutualFollows(user!.id, profile.id, 2),
    enabled: !!user?.id && !isOwnProfile,
    staleTime: 1000 * 60 * 5,
  });

  const mutualText = (() => {
    if (!mutualFollows || mutualFollows.totalCount === 0) return null;
    const names = mutualFollows.users.map((u) => u.display_name);
    const remaining = mutualFollows.totalCount - names.length;
    if (names.length === 1 && remaining === 0) {
      return `Followed by ${names[0]}`;
    }
    if (names.length === 2 && remaining === 0) {
      return `Followed by ${names[0]} and ${names[1]}`;
    }
    if (remaining > 0) {
      return `Followed by ${names.join(", ")} and ${remaining} ${remaining === 1 ? "other" : "others"}`;
    }
    return `Followed by ${names.join(" and ")}`;
  })();

  return (
    <div className="relative" style={accentStyle}>
      {/* Cover photo or gradient */}
      <div className="h-44 sm:h-52 relative overflow-hidden">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={
              themeColor
                ? {
                    background: `linear-gradient(135deg, color-mix(in oklab, ${themeColor} 20%, transparent), color-mix(in oklab, ${themeColor} 10%, transparent), transparent)`,
                  }
                : undefined
            }
          >
            {!themeColor && (
              <div className="w-full h-full bg-gradient-to-br from-primary/25 via-purple-500/20 via-60% to-cyan-500/15" />
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
      </div>

      <div className="relative px-5 -mt-12 pb-5 space-y-4">
        {/* Avatar + Stats row */}
        <div className="flex items-end gap-5">
          {/* Avatar */}
          <UserAvatar
            src={profile.avatar_url}
            fallback={profile.display_name}
            size="xl"
            className="h-24 w-24 shrink-0 ring-4 ring-background shadow-xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
            avatarBorder={avatarBorder}
          />

          {/* Stats */}
          <div className="flex items-center gap-6 pb-1">
            {[
              { value: profile.post_count, label: "Posts" },
              { value: profile.follower_count, label: "Followers" },
              { value: profile.following_count, label: "Following" },
            ].map((stat) => (
              <button
                key={stat.label}
                className="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity"
              >
                <span className="text-2xl font-extrabold leading-tight">
                  {formatNumber(stat.value)}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {stat.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Name + Username */}
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-extrabold">
              {profile.display_name}
            </h1>
            {profile.is_verified && (
              <BadgeCheck
                className={themeColor ? "h-5 w-5" : "h-5 w-5 text-primary fill-primary/20"}
                style={themeColor ? { color: themeColor, fill: `color-mix(in oklab, ${themeColor} 20%, transparent)` } : undefined}
              />
            )}
          </div>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {!isOwnProfile && mutualText && (
            <p className="text-xs text-muted-foreground/70 mt-1">{mutualText}</p>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-[14px] leading-[1.7] max-w-md">{profile.bio}</p>
        )}

        {/* Website + Join date */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
                    className={themeColor ? "inline-flex items-center gap-1 text-sm hover:underline" : "inline-flex items-center gap-1 text-sm text-primary hover:underline"}
                    style={themeColor ? { color: themeColor } : undefined}
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    {url.hostname}
                  </a>
                );
              } catch {
                return null;
              }
            })()}

          <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground/60">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatJoinDate(profile.created_at)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isOwnProfile ? (
            <>
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-10 px-5 text-sm font-semibold cursor-pointer"
                onClick={() => router.push("/settings/profile")}
              >
                Edit Profile
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl h-10 w-10"
                onClick={() => setQrOpen(true)}
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <FollowButton
                isFollowing={isFollowing}
                onToggle={onFollow}
                className="flex-1 rounded-xl h-10"
                style={
                  themeColor && !isFollowing
                    ? { backgroundColor: themeColor, borderColor: themeColor }
                    : undefined
                }
              />
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-10 px-5 text-sm font-semibold cursor-pointer"
              >
                <MessageCircle className="h-4 w-4 mr-1.5" />
                Message
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl h-10 w-10"
                onClick={() => setQrOpen(true)}
              >
                <QrCode className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl h-10 w-10"
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

      <QRCodeDialog
        username={profile.username}
        displayName={profile.display_name}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />
    </div>
  );
}
