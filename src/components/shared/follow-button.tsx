"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { aurora, O } from "@/lib/design/orbit";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";

interface FollowButtonProps {
  isFollowing: boolean;
  onToggle: () => Promise<void>;
  size?: "sm" | "default";
  className?: string;
  style?: React.CSSProperties;
}

export function FollowButton({
  isFollowing,
  onToggle,
  size = "default",
  className,
  style,
}: FollowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);
  const requireAuth = useRequireAuth();

  const handleClick = async () => {
    if (!requireAuth()) return;
    setLoading(true);
    try {
      await onToggle();
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.1 }}>
      <Button
        variant={isFollowing ? "outline" : "default"}
        size={size}
        onClick={handleClick}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        disabled={loading}
        style={
          !isFollowing
            ? {
                background: aurora,
                color: "white",
                boxShadow: `0 8px 24px -6px color-mix(in oklab, ${O.a1} 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)`,
                ...style,
              }
            : style
        }
        className={cn(
          // No fixed min-width, let the button hug its label so it
          // takes less horizontal space in tight side-rails / mobile.
          "rounded-full transition-all duration-200 active:scale-[0.97] px-4",
          !isFollowing && "border-0",
          isFollowing && "border-white/[0.12] hover:border-destructive hover:text-destructive hover:bg-destructive/10",
          isFollowing &&
            hovering &&
            "border-destructive text-destructive bg-destructive/10",
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
    </motion.div>
  );
}
