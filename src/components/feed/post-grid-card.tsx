"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { formatNumber } from "@/lib/utils/format";
import { type PostWithAuthor } from "@/lib/queries/posts";
import { useAuth } from "@/lib/hooks/use-auth";
import { useHideLikeCounts } from "@/lib/hooks/use-profile";

const gradients = [
  "from-violet-600/60 to-indigo-800/60",
  "from-cyan-600/60 to-blue-800/60",
  "from-rose-600/60 to-pink-800/60",
  "from-emerald-600/60 to-teal-800/60",
  "from-amber-600/60 to-orange-800/60",
];

interface PostGridCardProps {
  post: PostWithAuthor;
  index?: number;
}

export function PostGridCard({ post, index = 0 }: PostGridCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const hideLikeCounts = useHideLikeCounts();
  const countsHidden = hideLikeCounts && post.user_id !== user?.id;
  const media = post.post_media?.[0];
  const profile = post.profiles;
  const gradient = gradients[index % gradients.length];

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      onClick={() => router.push(`/post/${post.id}`)}
      className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
    >
      {/* Background */}
      {media ? (
        <Image
          src={media.url}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 300px"
          className="object-cover"
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} p-4 flex items-end`}>
          <p className="text-white text-sm font-medium leading-snug line-clamp-4">
            {post.content}
          </p>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-6">
        {!countsHidden && (
          <div className="flex items-center gap-1.5 text-white font-semibold text-sm">
            <Heart className="h-5 w-5 fill-white" />
            {formatNumber(post.like_count)}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-white font-semibold text-sm">
          <MessageCircle className="h-5 w-5 fill-white" />
          {formatNumber(post.comment_count)}
        </div>
      </div>

      {/* Bottom info for media posts */}
      {media && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white text-xs font-semibold">{profile.username}</p>
        </div>
      )}
    </motion.div>
  );
}
