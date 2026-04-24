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
    <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.1 }}>
      <Button
        variant={isFollowing ? "outline" : "default"}
        size={size}
        onClick={handleClick}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        disabled={loading}
        style={!isFollowing ? { backgroundImage: "linear-gradient(135deg, oklch(0.623 0.214 259), oklch(0.55 0.2 280))", ...style } : undefined}
        className={cn(
          "rounded-full min-w-[110px] transition-all duration-200 active:scale-[0.97]",
          !isFollowing && "border-0 shadow-[0_2px_12px_oklch(0.623_0.214_259_/_25%)] hover:shadow-[0_4px_20px_oklch(0.623_0.214_259_/_35%)]",
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
