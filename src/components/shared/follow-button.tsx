"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import type { FollowState } from "@/lib/queries/social";

interface FollowButtonProps {
  state: FollowState;
  onToggle: () => Promise<void>;
  size?: "sm" | "default";
  className?: string;
  style?: React.CSSProperties;
}

export function FollowButton({
  state,
  onToggle,
  size = "default",
  className,
  style,
}: FollowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);
  const requireAuth = useRequireAuth();
  // "Requested" and "Following" share the outline treatment: both mean the
  // next tap undoes something.
  const isActive = state !== "none";

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
        variant={isActive ? "outline" : "default"}
        size={size}
        onClick={handleClick}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        disabled={loading}
        style={style}
        className={cn(
          // No fixed min-width, let the button hug its label so it
          // takes less horizontal space in tight side-rails / mobile.
          "rounded-full transition-all duration-200 active:scale-[0.97] px-4",
          !isActive && "border-0 bg-primary text-primary-foreground",
          isActive &&
            "border border-border bg-surface text-foreground hover:border-destructive/40 hover:text-destructive hover:bg-destructive/10",
          isActive &&
            hovering &&
            "border-destructive/40 text-destructive bg-destructive/10",
          className
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "following" ? (
          hovering ? (
            "Unfollow"
          ) : (
            "Following"
          )
        ) : state === "requested" ? (
          hovering ? (
            "Cancel"
          ) : (
            "Requested"
          )
        ) : (
          "Follow"
        )}
      </Button>
    </motion.div>
  );
}
