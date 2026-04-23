"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string | null;
  fallback: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  hasStory?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-24 w-24",
};

export function UserAvatar({
  src,
  fallback,
  size = "md",
  className,
  hasStory = false,
}: UserAvatarProps) {
  return (
    <div
      className={cn(
        "relative rounded-full",
        hasStory &&
          "p-[2px] bg-gradient-to-tr from-primary via-purple-500 to-pink-500"
      )}
    >
      <Avatar
        className={cn(
          sizeClasses[size],
          hasStory && "border-2 border-background",
          className
        )}
      >
        <AvatarImage src={src || undefined} />
        <AvatarFallback className="bg-muted text-muted-foreground">
          {fallback.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
