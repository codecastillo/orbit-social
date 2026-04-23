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
import { Button } from "@/components/ui/button";
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
      toast.error("Sign in to bookmark posts");
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
      toast.error("Failed to bookmark post");
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
      className="bg-card rounded-2xl border border-border/60 shadow-sm cursor-pointer transition-shadow duration-200 hover:shadow-md"
      onClick={navigateToPost}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <div className={cn("flex gap-3", compact ? "p-3" : "px-4 pt-4 pb-3")}>
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
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link
                href={`/${profile.username}`}
                onClick={(e) => e.stopPropagation()}
                className="font-bold text-[15px] hover:underline truncate"
              >
                {profile.display_name}
              </Link>
              <Link
                href={`/${profile.username}`}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground text-[13px] truncate"
              >
                @{profile.username}
              </Link>
              <span className="text-muted-foreground/60 text-[13px] shrink-0">
                &middot; {formatTimeAgo(post.created_at)}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwnPost ? (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    className="text-destructive"
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
            <div className="mt-1.5">
              <PostContent content={post.content} />
            </div>
          )}

          {/* Media */}
          {post.post_media && post.post_media.length > 0 && (
            <div
              className={cn(
                "mt-3 rounded-xl overflow-hidden shadow-sm",
                post.post_media.length === 1 && "max-h-[420px]",
                post.post_media.length > 1 && "grid gap-0.5",
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

          {/* Actions */}
          <div className="flex items-center justify-between mt-3 -mx-2">
            <ActionButton
              icon={MessageCircle}
              count={post.comment_count}
              onClick={(e) => {
                e.stopPropagation();
                navigateToPost();
              }}
              color="blue"
            />
            <ActionButton
              icon={Repeat2}
              count={post.repost_count}
              onClick={(e) => e.stopPropagation()}
              color="green"
            />
            <ActionButton
              icon={Heart}
              count={likeCount}
              onClick={handleLike}
              active={isLiked}
              color="pink"
            />
            <ActionButton
              icon={Share}
              onClick={handleShare}
              color="green"
            />
            <ActionButton
              icon={Bookmark}
              count={bookmarkCount > 0 ? bookmarkCount : undefined}
              onClick={handleBookmark}
              active={isBookmarked}
              color="yellow"
            />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function PostContent({ content }: { content: string }) {
  // Parse hashtags and mentions into links
  const parts = content.split(/([@#]\w+)/g);

  return (
    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          return (
            <Link
              key={i}
              href={`/explore/search?q=${encodeURIComponent(part)}`}
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline font-medium"
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
              className="text-primary hover:underline font-medium"
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
  color: "blue" | "green" | "pink" | "yellow";
}) {
  const [animateLike, setAnimateLike] = useState(false);

  const colorClasses = {
    blue: active
      ? "text-blue-500"
      : "hover:text-blue-500 hover:bg-blue-500/10",
    green: active
      ? "text-green-500"
      : "hover:text-green-500 hover:bg-green-500/10",
    pink: active
      ? "text-pink-500"
      : "hover:text-pink-500 hover:bg-pink-500/10",
    yellow: active
      ? "text-amber-500"
      : "hover:text-amber-500 hover:bg-amber-500/10",
  };

  const handleClick = (e: React.MouseEvent) => {
    if (color === "pink") {
      setAnimateLike(true);
      setTimeout(() => setAnimateLike(false), 300);
    }
    onClick(e);
  };

  return (
    <motion.button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-1.5 py-1.5 px-2.5 rounded-full transition-colors text-muted-foreground",
        colorClasses[color]
      )}
    >
      <motion.span
        animate={
          animateLike && color === "pink"
            ? { scale: [1, 1.3, 1] }
            : { scale: 1 }
        }
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex items-center"
      >
        <Icon
          className={cn(
            "h-[18px] w-[18px]",
            active && color === "pink" && "fill-current",
            active && color === "yellow" && "fill-current"
          )}
        />
      </motion.span>
      {count !== undefined && count > 0 && (
        <span className="text-[13px] font-medium">{formatNumber(count)}</span>
      )}
    </motion.button>
  );
}
