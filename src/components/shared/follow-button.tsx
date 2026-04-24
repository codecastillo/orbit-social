"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  const handleClick = async () => {
    setLoading(true);
    try {
      await onToggle();
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div whileTap={{ scale: 0.95 }} transition={{ duration: 0.1 }}>
      <Button
        variant={isFollowing ? "outline" : "default"}
        size={size}
        onClick={handleClick}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        disabled={loading}
        style={!isFollowing ? style : undefined}
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
    </motion.div>
  );
}
