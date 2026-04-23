"use client";

import { useState } from "react";
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import { toggleLike, toggleBookmark } from "@/lib/queries/posts";
import { useAuth } from "@/lib/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

interface ReelActionsProps {
  postId: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
}

export function ReelActions({
  postId,
  likeCount,
  commentCount,
  bookmarkCount,
  isLiked: initialIsLiked,
  isBookmarked: initialIsBookmarked,
}: ReelActionsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [localLikeCount, setLocalLikeCount] = useState(likeCount);
  const [localBookmarkCount, setLocalBookmarkCount] = useState(bookmarkCount);

  const handleLike = async () => {
    if (!user) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLocalLikeCount((c) => (wasLiked ? c - 1 : c + 1));
    try {
      await toggleLike(user.id, postId, wasLiked);
      queryClient.invalidateQueries({ queryKey: ["reels"] });
    } catch {
      setIsLiked(wasLiked);
      setLocalLikeCount((c) => (wasLiked ? c + 1 : c - 1));
    }
  };

  const handleBookmark = async () => {
    if (!user) return;
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);
    setLocalBookmarkCount((c) => (wasBookmarked ? c - 1 : c + 1));
    try {
      await toggleBookmark(user.id, postId, wasBookmarked);
      queryClient.invalidateQueries({ queryKey: ["reels"] });
    } catch {
      setIsBookmarked(wasBookmarked);
      setLocalBookmarkCount((c) => (wasBookmarked ? c + 1 : c - 1));
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        url: `${window.location.origin}/reels/${postId}`,
      });
    } else {
      await navigator.clipboard.writeText(
        `${window.location.origin}/reels/${postId}`
      );
    }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Like */}
      <button onClick={handleLike} className="flex flex-col items-center gap-1">
        <motion.div
          whileTap={{ scale: 1.3 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <Heart
            className={cn(
              "size-7",
              isLiked
                ? "fill-red-500 text-red-500"
                : "fill-none text-white"
            )}
          />
        </motion.div>
        <span className="text-white text-xs font-medium">
          {formatNumber(localLikeCount)}
        </span>
      </button>

      {/* Comment */}
      <button className="flex flex-col items-center gap-1">
        <MessageCircle className="size-7 text-white" />
        <span className="text-white text-xs font-medium">
          {formatNumber(commentCount)}
        </span>
      </button>

      {/* Share */}
      <button
        onClick={handleShare}
        className="flex flex-col items-center gap-1"
      >
        <Share2 className="size-7 text-white" />
        <span className="text-white text-xs font-medium">Share</span>
      </button>

      {/* Bookmark */}
      <button
        onClick={handleBookmark}
        className="flex flex-col items-center gap-1"
      >
        <Bookmark
          className={cn(
            "size-7",
            isBookmarked
              ? "fill-white text-white"
              : "fill-none text-white"
          )}
        />
        <span className="text-white text-xs font-medium">
          {formatNumber(localBookmarkCount)}
        </span>
      </button>
    </div>
  );
}
