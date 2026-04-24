"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Send,
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
      className="cursor-pointer border-b border-white/[0.06]"
      onClick={navigateToPost}
      whileHover={{ opacity: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header row: avatar + username + menu */}
      <div className="flex items-center px-4 py-3">
        <Link
          href={`/${profile.username}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <UserAvatar
            src={profile.avatar_url}
            fallback={profile.display_name}
            size="sm"
          />
        </Link>

        <Link
          href={`/${profile.username}`}
          onClick={(e) => e.stopPropagation()}
          className="ml-3 font-semibold text-sm text-zinc-100 hover:underline truncate"
        >
          {profile.username}
        </Link>

        <span className="ml-2 text-xs text-zinc-500">
          {formatTimeAgo(post.created_at)}
        </span>

        <div className="ml-auto">
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
      </div>

      {/* Media section -- full width, edge to edge, no rounding */}
      {hasMedia && (
        <div
          className={cn(
            "overflow-hidden",
            post.post_media.length === 1 && "aspect-square",
            post.post_media.length > 1 && "grid gap-[1px]",
            post.post_media.length === 2 && "grid-cols-2 aspect-square",
            post.post_media.length >= 3 && "grid-cols-2 grid-rows-2 aspect-square"
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

      {/* Actions row */}
      <div className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-4">
          <ActionButton
            icon={Heart}
            onClick={handleLike}
            active={isLiked}
            activeClass="text-rose-500 fill-rose-500"
            animateOnClick
          />
          <ActionButton
            icon={MessageCircle}
            onClick={(e) => {
              e.stopPropagation();
              navigateToPost();
            }}
          />
          <ActionButton
            icon={Send}
            onClick={handleShare}
          />
        </div>
        <ActionButton
          icon={Bookmark}
          onClick={handleBookmark}
          active={isBookmarked}
          activeClass="text-zinc-100 fill-zinc-100"
        />
      </div>

      {/* Like count */}
      {likeCount > 0 && (
        <div className="px-4 pb-1">
          <span className="text-sm font-semibold text-zinc-100">
            {formatNumber(likeCount)} {likeCount === 1 ? "like" : "likes"}
          </span>
        </div>
      )}

      {/* Caption: username + content inline */}
      {post.content && (
        <div className="px-4 pb-1">
          <p className="text-sm leading-relaxed">
            <Link
              href={`/${profile.username}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-zinc-100 hover:underline mr-1.5"
            >
              {profile.username}
            </Link>
            <PostContent content={post.content} />
          </p>
        </div>
      )}

      {/* Comment count */}
      {post.comment_count > 0 && (
        <div className="px-4 pb-1">
          <span className="text-sm text-zinc-500">
            View all {post.comment_count} comments
          </span>
        </div>
      )}

      {/* Timestamp */}
      <div className="px-4 pb-4">
        <span className="text-[10px] uppercase tracking-wide text-zinc-600">
          {formatTimeAgo(post.created_at)}
        </span>
      </div>
    </motion.article>
  );
}

function PostContent({ content }: { content: string }) {
  // Parse hashtags and mentions into links
  const parts = content.split(/([@#]\w+)/g);

  return (
    <span className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          return (
            <Link
              key={i}
              href={`/explore/search?q=${encodeURIComponent(part)}`}
              onClick={(e) => e.stopPropagation()}
              className="text-blue-400 hover:text-blue-300"
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
              className="text-blue-400 hover:text-blue-300"
            >
              {part}
            </Link>
          );
        }
        return part;
      })}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  onClick,
  active = false,
  activeClass,
  animateOnClick = false,
}: {
  icon: React.ElementType;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  activeClass?: string;
  animateOnClick?: boolean;
}) {
  const [animatePop, setAnimatePop] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (animateOnClick) {
      setAnimatePop(true);
      setTimeout(() => setAnimatePop(false), 300);
    }
    onClick(e);
  };

  return (
    <motion.button
      onClick={handleClick}
      className="transition-colors duration-200"
    >
      <motion.span
        animate={
          animatePop
            ? { scale: [1, 1.3, 1] }
            : { scale: 1 }
        }
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex items-center"
      >
        <Icon
          className={cn(
            "h-6 w-6",
            active && activeClass
              ? activeClass
              : "text-zinc-100 hover:text-zinc-400"
          )}
        />
      </motion.span>
    </motion.button>
  );
}
