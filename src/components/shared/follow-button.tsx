"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  isFollowing: boolean;
  onToggle: () => Promise<void>;
  size?: "sm" | "default";
  className?: string;
}

export function FollowButton({
  isFollowing,
  onToggle,
  size = "default",
  className,
}: FollowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onToggle();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size={size}
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      disabled={loading}
      className={cn(
        "rounded-full min-w-[100px] transition-all",
        isFollowing &&
          hovering &&
          "border-destructive text-destructive hover:bg-destructive/10",
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        hovering ? (
          "Unfollow"
        ) : (
          "Following"
        )
      ) : (
        "Follow"
      )}
    </Button>
  );
}
