"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type AvatarBorderStyle =
  | "none"
  | "gradient-rainbow"
  | "gold"
  | "silver"
  | "diamond"
  | "animated-glow";

interface UserAvatarProps {
  src?: string | null;
  fallback: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  hasStory?: boolean;
  avatarBorder?: AvatarBorderStyle;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-24 w-24",
};

const borderClasses: Record<AvatarBorderStyle, string> = {
  none: "",
  "gradient-rainbow":
    "p-[2px] bg-gradient-to-tr from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500",
  gold: "p-[2px] bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600",
  silver:
    "p-[2px] bg-gradient-to-br from-zinc-300 via-slate-400 to-zinc-500",
  diamond:
    "p-[2px] bg-gradient-to-br from-cyan-200 via-blue-300 to-indigo-400",
  "animated-glow":
    "p-[2px] avatar-animated-glow",
};

export function UserAvatar({
  src,
  fallback,
  size = "md",
  className,
  hasStory = false,
  avatarBorder = "none",
}: UserAvatarProps) {
  const hasBorderStyle = avatarBorder !== "none";
  const hasRing = hasStory || hasBorderStyle;

  return (
    <div
      className={cn(
        "relative rounded-full",
        hasStory && !hasBorderStyle &&
          "p-[2px] bg-gradient-to-tr from-primary via-purple-500 to-pink-500",
        hasBorderStyle && borderClasses[avatarBorder]
      )}
    >
      <Avatar
        className={cn(
          sizeClasses[size],
          hasRing && "border-2 border-background",
          className
        )}
      >
        <AvatarImage src={src || undefined} className="object-cover" />
        <AvatarFallback
          className="text-white font-semibold"
          style={{
            background:
              "linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #67e8f9 100%)",
          }}
        >
          {fallback.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Animated glow styles are in globals.css */}
    </div>
  );
}
