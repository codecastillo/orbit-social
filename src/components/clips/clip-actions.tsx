"use client";

import { useState } from "react";
import { Heart, MessageCircle, Share2, Bookmark, Repeat } from "lucide-react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils/format";
import {
  toggleLike,
  toggleBookmark,
  createRepost,
  undoRepost,
} from "@/lib/queries/posts";
import { useAuth } from "@/lib/hooks/use-auth";
import { useHideLikeCounts } from "@/lib/hooks/use-profile";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { createClient } from "@/lib/supabase/client";
import { ShareDialog } from "@/components/shared/share-dialog";

interface ClipActionsProps {
  postId: string;
  /** Clip author, so the viewer's hide-like-counts setting can spare their own. */
  authorId: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  shareCount: number;
  repostCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  isReposted: boolean;
  onComment: () => void;
}

interface PillProps {
  icon: React.ReactNode;
  label: string;
  ariaLabel: string;
  onClick?: () => void;
}

// Slim TikTok-style action: bare icon with a soft drop-shadow for legibility,
// count below. No pill backdrop.
function ActionPill({ icon, label, ariaLabel, onClick }: PillProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex flex-col items-center gap-1 touch-manipulation"
    >
      <motion.div
        whileTap={{ scale: 1.25 }}
        transition={{ type: "spring", stiffness: 420, damping: 12 }}
        className="grid h-8 w-8 place-items-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
      >
        {icon}
      </motion.div>
      <span className="text-[11px] font-semibold tracking-[0.01em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
        {label}
      </span>
    </button>
  );
}

export function ClipActions({
  postId,
  authorId,
  likeCount,
  commentCount,
  bookmarkCount,
  shareCount,
  repostCount,
  isLiked: initialIsLiked,
  isBookmarked: initialIsBookmarked,
  isReposted: initialIsReposted,
  onComment,
}: ClipActionsProps) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [isReposted, setIsReposted] = useState(initialIsReposted);
  const [localRepostCount, setLocalRepostCount] = useState(repostCount);
  const [localLikeCount, setLocalLikeCount] = useState(likeCount);
  const [localBookmarkCount, setLocalBookmarkCount] = useState(bookmarkCount);
  const [localShareCount, setLocalShareCount] = useState(shareCount);
  const [shareOpen, setShareOpen] = useState(false);
  const hideLikeCounts = useHideLikeCounts();
  // Own clips keep their count; the setting only hides other people's.
  const countsHidden = hideLikeCounts && authorId !== user?.id;

  // Render-time adjustments (not effects): adopt the authoritative counts
  // when the props update (realtime refetch from the parent feed after
  // another user's interaction), keeping optimistic bumps between refetches.
  const [prevLikeCount, setPrevLikeCount] = useState(likeCount);
  if (likeCount !== prevLikeCount) {
    setPrevLikeCount(likeCount);
    setLocalLikeCount(likeCount);
  }
  const [prevBookmarkCount, setPrevBookmarkCount] = useState(bookmarkCount);
  if (bookmarkCount !== prevBookmarkCount) {
    setPrevBookmarkCount(bookmarkCount);
    setLocalBookmarkCount(bookmarkCount);
  }
  const [prevRepostCount, setPrevRepostCount] = useState(repostCount);
  if (repostCount !== prevRepostCount) {
    setPrevRepostCount(repostCount);
    setLocalRepostCount(repostCount);
  }
  // Share count only ever grows, so a stale refetch can't clobber an
  // optimistic local bump back to a smaller number.
  const [prevShareCount, setPrevShareCount] = useState(shareCount);
  if (shareCount !== prevShareCount) {
    setPrevShareCount(shareCount);
    setLocalShareCount((prev) => Math.max(prev, shareCount));
  }

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

  // "Loop it" is the clips-native name for a repost: same createRepost/
  // undoRepost rows underneath, so a loop from here shows up on the
  // user's profile and in followers' feeds like any other repost.
  const handleLoopIt = async () => {
    if (!requireAuth() || !user) return;
    const wasReposted = isReposted;
    setIsReposted(!wasReposted);
    setLocalRepostCount((c) => (wasReposted ? c - 1 : c + 1));
    try {
      if (wasReposted) {
        await undoRepost(user.id, postId);
      } else {
        await createRepost(user.id, postId);
      }
      queryClient.invalidateQueries({ queryKey: ["clips"] });
    } catch {
      setIsReposted(wasReposted);
      setLocalRepostCount((c) => (wasReposted ? c + 1 : c - 1));
      toast.error("Couldn't loop this clip");
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
            className={`h-[26px] w-[26px] ${
              isLiked ? "fill-primary text-primary" : "fill-transparent text-white"
            }`}
            strokeWidth={isLiked ? 0 : 1.8}
          />
        }
        label={countsHidden ? "" : formatNumber(localLikeCount)}
        ariaLabel={isLiked ? "Unlike" : "Like"}
        onClick={handleLike}
      />
      <ActionPill
        icon={<MessageCircle className="h-[26px] w-[26px]" strokeWidth={1.8} />}
        label={formatNumber(commentCount)}
        ariaLabel="Comments"
        onClick={onComment}
      />
      <ActionPill
        icon={
          <Bookmark
            className={`h-[26px] w-[26px] ${
              isBookmarked ? "fill-primary text-primary" : "fill-transparent text-white"
            }`}
            strokeWidth={isBookmarked ? 0 : 1.8}
          />
        }
        label={formatNumber(localBookmarkCount)}
        ariaLabel={isBookmarked ? "Remove bookmark" : "Bookmark"}
        onClick={handleBookmark}
      />
      <ActionPill
        icon={
          <Repeat
            className={`h-[26px] w-[26px] ${
              isReposted ? "text-primary" : "text-white"
            }`}
            strokeWidth={isReposted ? 2.4 : 1.8}
          />
        }
        label={localRepostCount > 0 ? formatNumber(localRepostCount) : "Loop it"}
        ariaLabel={isReposted ? "Undo loop" : "Loop it"}
        onClick={handleLoopIt}
      />
      <ActionPill
        icon={<Share2 className="h-[26px] w-[26px]" strokeWidth={1.8} />}
        label={localShareCount > 0 ? formatNumber(localShareCount) : "Share"}
        ariaLabel="Share"
        onClick={handleShare}
      />
      <ShareDialog
        postId={postId}
        path={`/clips/${postId}`}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </div>
  );
}
