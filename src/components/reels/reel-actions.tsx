"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils/format";
import { toggleLike, toggleBookmark } from "@/lib/queries/posts";
import { useAuth } from "@/lib/hooks/use-auth";
import { O, aurora } from "@/lib/design/orbit";

interface ReelActionsProps {
  postId: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
}

interface PillProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  activeTint?: string;
  onClick?: () => void;
}

function ActionPill({ icon, label, active, activeTint, onClick }: PillProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 group"
      style={{ touchAction: "manipulation" }}
    >
      <motion.div
        whileTap={{ scale: 1.25 }}
        transition={{ type: "spring", stiffness: 420, damping: 12 }}
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: active && activeTint ? activeTint : "rgba(10,12,28,0.55)",
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
          border: `1px solid ${active ? "rgba(255,255,255,0.22)" : O.hair}`,
          boxShadow: active
            ? `0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 28px -10px ${O.a2}66`
            : "0 0 0 1px rgba(255,255,255,0.04) inset, 0 4px 16px -8px rgba(0,0,0,0.6)",
          color: O.ink,
        }}
      >
        {icon}
      </motion.div>
      <span
        style={{
          fontFamily: O.sans,
          fontSize: 11,
          fontWeight: 600,
          color: O.ink,
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </span>
    </button>
  );
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [localLikeCount, setLocalLikeCount] = useState(likeCount);
  const [localBookmarkCount, setLocalBookmarkCount] = useState(bookmarkCount);

  const handleLike = async () => {
    if (!user) {
      toast.error("Sign in to like clips");
      return;
    }
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLocalLikeCount((c) => (wasLiked ? c - 1 : c + 1));
    try {
      await toggleLike(user.id, postId, wasLiked);
      queryClient.invalidateQueries({ queryKey: ["reels"] });
    } catch {
      setIsLiked(wasLiked);
      setLocalLikeCount((c) => (wasLiked ? c + 1 : c - 1));
      toast.error("Couldn't update like");
    }
  };

  const handleBookmark = async () => {
    if (!user) {
      toast.error("Sign in to save clips");
      return;
    }
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);
    setLocalBookmarkCount((c) => (wasBookmarked ? c - 1 : c + 1));
    try {
      await toggleBookmark(user.id, postId, wasBookmarked);
      queryClient.invalidateQueries({ queryKey: ["reels"] });
    } catch {
      setIsBookmarked(wasBookmarked);
      setLocalBookmarkCount((c) => (wasBookmarked ? c + 1 : c - 1));
      toast.error("Couldn't update save");
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <ActionPill
        icon={
          <Heart
            style={{
              width: 22,
              height: 22,
              fill: isLiked ? O.a2 : "transparent",
              color: isLiked ? O.a2 : O.ink,
              filter: isLiked ? `drop-shadow(0 0 8px ${O.a2})` : undefined,
            }}
            strokeWidth={2}
          />
        }
        label={formatNumber(localLikeCount)}
        active={isLiked}
        activeTint={`${O.a2}33`}
        onClick={handleLike}
      />
      <ActionPill
        icon={<MessageCircle style={{ width: 22, height: 22 }} strokeWidth={2} />}
        label={formatNumber(commentCount)}
        onClick={() => router.push(`/post/${postId}`)}
      />
      <ActionPill
        icon={
          <Bookmark
            style={{
              width: 22,
              height: 22,
              fill: isBookmarked ? O.a3 : "transparent",
              color: isBookmarked ? O.a3 : O.ink,
              filter: isBookmarked ? `drop-shadow(0 0 8px ${O.a3})` : undefined,
            }}
            strokeWidth={2}
          />
        }
        label={formatNumber(localBookmarkCount)}
        active={isBookmarked}
        activeTint={`${O.a3}33`}
        onClick={handleBookmark}
      />
      <ActionPill
        icon={<Share2 style={{ width: 22, height: 22 }} strokeWidth={2} />}
        label="Share"
        onClick={handleShare}
      />
    </div>
  );
}
