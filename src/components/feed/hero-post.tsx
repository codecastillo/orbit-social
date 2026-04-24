"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatNumber, formatTimeAgo } from "@/lib/utils/format";
import { useAuth } from "@/lib/hooks/use-auth";
import { toggleLike, type PostWithAuthor } from "@/lib/queries/posts";
import { toast } from "sonner";

interface HeroPostProps {
  post: PostWithAuthor;
  isLiked?: boolean;
}

export function HeroPost({ post, isLiked: initialLiked = false }: HeroPostProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const profile = post.profiles;
  const media = post.post_media?.[0];

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const was = isLiked;
    setIsLiked(!was);
    setLikeCount((c) => (was ? c - 1 : c + 1));
    try {
      await toggleLike(user.id, post.id, was);
    } catch {
      setIsLiked(was);
      setLikeCount((c) => (was ? c + 1 : c - 1));
      toast.error("Failed");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => router.push(`/post/${post.id}`)}
      className="relative w-full min-h-[420px] rounded-2xl overflow-hidden cursor-pointer group"
    >
      {/* Background */}
      {media ? (
        <img
          src={media.url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/80 via-indigo-600/70 to-cyan-500/60" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

      {/* Like button */}
      <button
        onClick={handleLike}
        className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
      >
        <Heart
          className={cn(
            "h-5 w-5 transition-colors",
            isLiked ? "text-rose-500 fill-rose-500" : "text-white"
          )}
        />
      </button>

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
        <div className="flex items-center gap-2.5 mb-3">
          <UserAvatar src={profile.avatar_url} fallback={profile.display_name} size="sm" />
          <span className="text-white font-semibold text-sm">{profile.username}</span>
          <span className="text-white/50 text-xs">{formatTimeAgo(post.created_at)}</span>
        </div>

        {post.content && (
          <p className="text-white text-lg font-medium leading-snug line-clamp-3 mb-3 max-w-lg">
            {post.content}
          </p>
        )}

        <div className="flex items-center gap-4 text-white/70 text-sm">
          <span className="font-semibold text-white">{formatNumber(likeCount)} likes</span>
          <span>{formatNumber(post.comment_count)} comments</span>
        </div>
      </div>

      {/* Hover shimmer */}
      <div className="absolute inset-0 bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </motion.div>
  );
}
