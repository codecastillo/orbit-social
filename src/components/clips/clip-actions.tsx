"use client";

import { useState } from "react";
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect } from "react";
import { formatNumber } from "@/lib/utils/format";
import { toggleLike, toggleBookmark } from "@/lib/queries/posts";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { createClient } from "@/lib/supabase/client";
import { ShareDialog } from "@/components/shared/share-dialog";
import { O } from "@/lib/design/orbit";

interface ClipActionsProps {
  postId: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  shareCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  onComment: () => void;
}

interface PillProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

// Slim TikTok-style action: bare icon with a soft drop-shadow for legibility,
// count below. No glass pill backdrop.
function ActionPill({ icon, label, onClick }: PillProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1"
      style={{ touchAction: "manipulation" }}
    >
      <motion.div
        whileTap={{ scale: 1.25 }}
        transition={{ type: "spring", stiffness: 420, damping: 12 }}
        style={{
          width: 32,
          height: 32,
          display: "grid",
          placeItems: "center",
          color: O.ink,
          filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.7))",
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
          textShadow: "0 1px 2px rgba(0,0,0,0.7)",
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </span>
    </button>
  );
}

export function ClipActions({
  postId,
  likeCount,
  commentCount,
  bookmarkCount,
  shareCount,
  isLiked: initialIsLiked,
  isBookmarked: initialIsBookmarked,
  onComment,
}: ClipActionsProps) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [localLikeCount, setLocalLikeCount] = useState(likeCount);
  const [localBookmarkCount, setLocalBookmarkCount] = useState(bookmarkCount);
  const [localShareCount, setLocalShareCount] = useState(shareCount);
  const [shareOpen, setShareOpen] = useState(false);

  // Sync local count state when authoritative props update (realtime
  // refetch from the parent feed after another user's interaction). For
  // share count we only adopt the prop when it grows, never let a stale
  // refetch clobber an optimistic local bump back to a smaller number.
  useEffect(() => setLocalLikeCount(likeCount), [likeCount]);
  useEffect(() => setLocalBookmarkCount(bookmarkCount), [bookmarkCount]);
  useEffect(() => {
    setLocalShareCount((prev) => Math.max(prev, shareCount));
  }, [shareCount]);

  const handleLike = async () => {
    if (!requireAuth() || !user) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLocalLikeCount((c) => (wasLiked ? c - 1 : c + 1));
    try {
      await toggleLike(user.id, postId, wasLiked);
      queryClient.invalidateQueries({ queryKey: ["clips"] });
    } catch {
      setIsLiked(wasLiked);
      setLocalLikeCount((c) => (wasLiked ? c + 1 : c - 1));
      toast.error("Couldn't update like");
    }
  };

  const handleBookmark = async () => {
    if (!requireAuth() || !user) return;
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);
    setLocalBookmarkCount((c) => (wasBookmarked ? c - 1 : c + 1));
    try {
      await toggleBookmark(user.id, postId, wasBookmarked);
      queryClient.invalidateQueries({ queryKey: ["clips"] });
    } catch {
      setIsBookmarked(wasBookmarked);
      setLocalBookmarkCount((c) => (wasBookmarked ? c + 1 : c - 1));
      toast.error("Couldn't update save");
    }
  };

  const handleShare = () => {
    if (!requireAuth() || !user) return;
    setLocalShareCount((c) => c + 1);
    // Persist server-side so the count survives refresh and is visible
    // to every other viewer. Surface failures (e.g. missing RPC) instead
    // of swallowing them.
    const supabase = createClient();
    supabase.rpc("increment_post_shares", { p_post_id: postId }).then(
      ({ error }) => {
        if (error) {
          console.error("increment_post_shares failed", error);
        }
      },
    );
    queryClient.invalidateQueries({ queryKey: ["clips"] });
    setShareOpen(true);
  };

  return (
    <div className="flex flex-col items-center gap-3.5">
      <ActionPill
        icon={
          <Heart
            style={{
              width: 26,
              height: 26,
              fill: isLiked ? O.a2 : "transparent",
              color: isLiked ? O.a2 : O.ink,
            }}
            strokeWidth={isLiked ? 0 : 1.8}
          />
        }
        label={formatNumber(localLikeCount)}
        onClick={handleLike}
      />
      <ActionPill
        icon={<MessageCircle style={{ width: 26, height: 26 }} strokeWidth={1.8} />}
        label={formatNumber(commentCount)}
        onClick={onComment}
      />
      <ActionPill
        icon={
          <Bookmark
            style={{
              width: 26,
              height: 26,
              fill: isBookmarked ? O.a3 : "transparent",
              color: isBookmarked ? O.a3 : O.ink,
            }}
            strokeWidth={isBookmarked ? 0 : 1.8}
          />
        }
        label={formatNumber(localBookmarkCount)}
        onClick={handleBookmark}
      />
      <ActionPill
        icon={<Share2 style={{ width: 26, height: 26 }} strokeWidth={1.8} />}
        label={localShareCount > 0 ? formatNumber(localShareCount) : "Share"}
        onClick={handleShare}
      />
      <ShareDialog postId={postId} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}
