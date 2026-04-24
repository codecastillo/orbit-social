"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  Bookmark,
  MoreHorizontal,
  Trash2,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatTimeAgo, formatNumber } from "@/lib/utils/format";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  toggleLike,
  toggleBookmark,
  deletePost,
  type PostWithAuthor,
} from "@/lib/queries/posts";

interface PostCardProps {
  post: PostWithAuthor;
  isLiked?: boolean;
  isBookmarked?: boolean;
  onUpdate?: () => void;
  compact?: boolean;
}

export function PostCard({
  post,
  isLiked: initialIsLiked = false,
  isBookmarked: initialIsBookmarked = false,
  onUpdate,
  compact = false,
}: PostCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmark_count);

  const isOwnPost = user?.id === post.user_id;
  const profile = post.profiles;
  const hasMedia = post.post_media && post.post_media.length > 0;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to like posts");
      return;
    }

    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1));

    try {
      await toggleLike(user.id, post.id, wasLiked);
    } catch {
      setIsLiked(wasLiked);
      setLikeCount((c) => (wasLiked ? c + 1 : c - 1));
      toast.error("Failed to like post");
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to save posts");
      return;
    }

    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);
    setBookmarkCount((c) => (wasBookmarked ? c - 1 : c + 1));

    try {
      await toggleBookmark(user.id, post.id, wasBookmarked);
    } catch {
      setIsBookmarked(wasBookmarked);
      setBookmarkCount((c) => (wasBookmarked ? c + 1 : c - 1));
      toast.error("Failed to save post");
    }
  };

  const handleDelete = async () => {
    try {
      await deletePost(post.id);
      toast.success("Post deleted");
      onUpdate?.();
    } catch {
      toast.error("Failed to delete post");
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/post/${post.id}`
      );
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const navigateToPost = () => {
    router.push(`/post/${post.id}`);
  };

  return (
    <motion.article
      className="group relative rounded-2xl bg-white/[0.03] border border-white/[0.06] cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-white/[0.12] overflow-hidden"
      onClick={navigateToPost}
      whileHover={{ y: -1, scale: 1.002 }}
      transition={{ duration: 0.2 }}
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/[0.04] via-transparent to-cyan-500/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Author row + content + menu */}
      <div className={cn("relative", compact ? "p-3" : "px-5 pt-5 pb-3")}>
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Link
            href={`/${profile.username}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          >
            <UserAvatar
              src={profile.avatar_url}
              fallback={profile.display_name}
              size={compact ? "md" : "lg"}
            />
          </Link>

          <div className="flex-1 min-w-0">
            {/* Author row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  href={`/${profile.username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold text-[15px] text-zinc-100 hover:underline truncate"
                >
                  {profile.display_name}
                </Link>
                <Link
                  href={`/${profile.username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-zinc-500 text-[13px] truncate"
                >
                  @{profile.username}
                </Link>
                <span className="bg-white/[0.06] rounded-full px-2 py-0.5 text-xs text-zinc-500 shrink-0">
                  {formatTimeAgo(post.created_at)}
                </span>
              </div>

              {/* More menu */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/[0.06] transition-colors">
                    <MoreHorizontal className="h-4 w-4 text-zinc-500" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-900/95 backdrop-blur-xl border-white/[0.08]">
                  {isOwnPost ? (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete();
                      }}
                      className="text-rose-400 focus:text-rose-400"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                      <Flag className="mr-2 h-4 w-4" />
                      Report
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Content */}
            {post.content && (
              <div className="mt-2">
                <PostContent content={post.content} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Media -- edge-to-edge within the card */}
      {hasMedia && (
        <div
          className={cn(
            "overflow-hidden",
            post.post_media.length === 1 && "max-h-[480px]",
            post.post_media.length > 1 && "grid gap-[2px]",
            post.post_media.length === 2 && "grid-cols-2",
            post.post_media.length >= 3 && "grid-cols-2 grid-rows-2"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {post.post_media
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((m, i) => (
              <div
                key={m.id}
                className={cn(
                  "overflow-hidden",
                  post.post_media.length === 3 && i === 0 && "row-span-2"
                )}
              >
                <img
                  src={m.url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
        </div>
      )}

      {/* Actions bar */}
      <div className={cn("relative flex items-center justify-between", compact ? "px-3 pb-3 pt-2" : "px-5 pb-4 pt-3")}>
        <ActionButton
          icon={MessageCircle}
          count={post.comment_count}
          onClick={(e) => {
            e.stopPropagation();
            navigateToPost();
          }}
          color="sky"
        />
        <ActionButton
          icon={Repeat2}
          count={post.repost_count}
          onClick={(e) => e.stopPropagation()}
          color="emerald"
        />
        <ActionButton
          icon={Heart}
          count={likeCount}
          onClick={handleLike}
          active={isLiked}
          color="rose"
        />
        <ActionButton
          icon={Share}
          onClick={handleShare}
          color="violet"
        />
        <ActionButton
          icon={Bookmark}
          count={bookmarkCount > 0 ? bookmarkCount : undefined}
          onClick={handleBookmark}
          active={isBookmarked}
          color="amber"
        />
      </div>
    </motion.article>
  );
}

function PostContent({ content }: { content: string }) {
  // Parse hashtags and mentions into links
  const parts = content.split(/([@#]\w+)/g);

  return (
    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-zinc-300">
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          return (
            <Link
              key={i}
              href={`/explore/search?q=${encodeURIComponent(part)}`}
              onClick={(e) => e.stopPropagation()}
              className="text-cyan-400 hover:text-cyan-300 hover:underline font-medium"
            >
              {part}
            </Link>
          );
        }
        if (part.startsWith("@")) {
          return (
            <Link
              key={i}
              href={`/${part.slice(1)}`}
              onClick={(e) => e.stopPropagation()}
              className="text-cyan-400 hover:text-cyan-300 hover:underline font-medium"
            >
              {part}
            </Link>
          );
        }
        return part;
      })}
    </p>
  );
}

function ActionButton({
  icon: Icon,
  count,
  onClick,
  active = false,
  color,
}: {
  icon: React.ElementType;
  count?: number;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  color: "sky" | "emerald" | "rose" | "violet" | "amber";
}) {
  const [animatePop, setAnimatePop] = useState(false);

  const styles: Record<typeof color, { active: string; idle: string }> = {
    rose: {
      active: "text-rose-400 bg-rose-400/10",
      idle: "text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 hover:shadow-[0_0_12px_rgba(244,63,94,0.15)]",
    },
    sky: {
      active: "text-sky-400 bg-sky-400/10",
      idle: "text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10 hover:shadow-[0_0_12px_rgba(14,165,233,0.15)]",
    },
    emerald: {
      active: "text-emerald-400 bg-emerald-400/10",
      idle: "text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 hover:shadow-[0_0_12px_rgba(16,185,129,0.15)]",
    },
    violet: {
      active: "text-violet-400 bg-violet-400/10",
      idle: "text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 hover:shadow-[0_0_12px_rgba(139,92,246,0.15)]",
    },
    amber: {
      active: "text-amber-400 bg-amber-400/10",
      idle: "text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 hover:shadow-[0_0_12px_rgba(245,158,11,0.15)]",
    },
  };

  const handleClick = (e: React.MouseEvent) => {
    if (color === "rose") {
      setAnimatePop(true);
      setTimeout(() => setAnimatePop(false), 300);
    }
    onClick(e);
  };

  return (
    <motion.button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-1.5 py-1.5 px-3 rounded-full transition-all duration-200",
        active ? styles[color].active : styles[color].idle
      )}
    >
      <motion.span
        animate={
          animatePop && color === "rose"
            ? { scale: [1, 1.35, 1] }
            : { scale: 1 }
        }
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex items-center"
      >
        <Icon
          className={cn(
            "h-[18px] w-[18px]",
            active && color === "rose" && "fill-current",
            active && color === "amber" && "fill-current"
          )}
        />
      </motion.span>
      {count !== undefined && count > 0 && (
        <span className="text-[13px] font-medium">{formatNumber(count)}</span>
      )}
    </motion.button>
  );
}
