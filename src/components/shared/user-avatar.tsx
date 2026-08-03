"use client";

import { useState } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  /**
   * Green-toned ring for close-friends stories, matching the emerald
   * Close Friends badge on posts. Only applies when hasStory is set.
   */
  storyTone?: "default" | "close-friends";
  avatarBorder?: AvatarBorderStyle;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-[126px] w-[126px]",
};

// next/image needs a rendered-size hint to pick the smallest source; these
// mirror sizeClasses (device-pixel scaling is handled by the loader).
const sizesAttr = {
  sm: "32px",
  md: "40px",
  lg: "56px",
  xl: "126px",
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
  // Formerly a spinning conic-gradient ring; looping decorative motion is
  // out, so legacy values render as a static accent ring.
  "animated-glow": "p-[2px] bg-primary",
};

export function UserAvatar({
  src,
  fallback,
  size = "md",
  className,
  hasStory = false,
  storyTone = "default",
  avatarBorder = "none",
}: UserAvatarProps) {
  const hasBorderStyle = avatarBorder !== "none";
  // Track load/error per URL so a src change (recycled list rows) retries.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;

  return (
    <div
      className={cn(
        "relative rounded-full",
        hasStory && !hasBorderStyle &&
          (storyTone === "close-friends"
            ? "p-[2px] bg-gradient-to-tr from-emerald-600 via-emerald-400 to-teal-300"
            : "p-[2px] bg-gradient-to-tr from-primary via-purple-500 to-pink-500"),
        hasBorderStyle && borderClasses[avatarBorder]
      )}
    >
      <Avatar className={cn(sizeClasses[size], className)}>
        {(!showImage || loadedSrc !== src) && (
          <AvatarFallback
            className="text-white font-semibold"
            style={{
              background:
                "linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #67e8f9 100%)",
            }}
          >
            {fallback.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        )}
        {showImage && (
          <Image
            src={src}
            alt=""
            fill
            sizes={sizesAttr[size]}
            className="rounded-full object-cover"
            onLoad={() => setLoadedSrc(src)}
            onError={() => setFailedSrc(src)}
          />
        )}
      </Avatar>
    </div>
  );
}
