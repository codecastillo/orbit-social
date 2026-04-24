"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostWithAuthor } from "@/lib/queries/posts";

interface ProfileGridProps {
  posts: PostWithAuthor[];
}

export function ProfileGrid({ posts }: ProfileGridProps) {
  const router = useRouter();

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-5">
        <p className="text-muted-foreground text-sm">No posts yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-[2px]">
      {posts.map((post) => (
        <GridItem key={post.id} post={post} onClick={() => router.push(`/post/${post.id}`)} />
      ))}
    </div>
  );
}

function GridItem({
  post,
  onClick,
}: {
  post: PostWithAuthor;
  onClick: () => void;
}) {
  const [hovering, setHovering] = useState(false);
  const firstMedia = post.post_media?.[0];
  const hasImage = firstMedia && (firstMedia.type === "image" || firstMedia.type === "gif");
  const hasVideo = firstMedia?.type === "video";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="relative aspect-square overflow-hidden bg-muted/30 focus:outline-none"
    >
      {hasImage && (
        <img
          src={firstMedia.url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
      {hasVideo && (
        <img
          src={firstMedia.thumbnail_url || firstMedia.url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
      {!hasImage && !hasVideo && (
        <div className="h-full w-full flex items-center justify-center bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground line-clamp-4 text-center leading-relaxed">
            {post.content || ""}
          </p>
        </div>
      )}

      {/* Hover overlay with stats */}
      <div
        className={cn(
          "absolute inset-0 bg-black/40 flex items-center justify-center gap-5 transition-opacity duration-150",
          hovering ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="flex items-center gap-1.5 text-white text-sm font-bold">
          <Heart className="h-4 w-4 fill-white" />
          {post.like_count}
        </span>
        <span className="flex items-center gap-1.5 text-white text-sm font-bold">
          <MessageCircle className="h-4 w-4 fill-white" />
          {post.comment_count}
        </span>
      </div>

      {/* Multi-image indicator */}
      {post.post_media && post.post_media.length > 1 && (
        <div className="absolute top-2 right-2">
          <svg
            className="h-4 w-4 text-white drop-shadow-md"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </div>
      )}
    </button>
  );
}
