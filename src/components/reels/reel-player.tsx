"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/utils/format";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ReelActions } from "./reel-actions";
import type { PostWithAuthor } from "@/lib/queries/posts";

interface ReelPlayerProps {
  reel: PostWithAuthor;
}

export function ReelPlayer({ reel }: ReelPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showCaption, setShowCaption] = useState(false);

  const videoUrl = reel.post_media?.[0]?.url;

  // IntersectionObserver: autoplay when visible, pause when not
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
          setIsPlaying(true);
        } else {
          video.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const caption = reel.content || "";
  const truncatedCaption =
    caption.length > 100 ? caption.slice(0, 100) + "..." : caption;

  return (
    <div
      ref={containerRef}
      className="relative h-dvh w-full snap-start bg-black flex items-center justify-center"
      onClick={togglePlay}
    >
      {/* Video */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-cover"
          loop
          muted
          playsInline
          preload="metadata"
          poster={reel.post_media?.[0]?.thumbnail_url || undefined}
        />
      ) : (
        <div className="text-white/50 text-sm">Video unavailable</div>
      )}

      {/* Play indicator (shown when paused) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/30 rounded-full p-4">
            <Play className="size-12 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Mute toggle - top right */}
      <button
        onClick={toggleMute}
        className="absolute top-5 right-5 z-10 bg-black/40 rounded-full p-2"
      >
        {isMuted ? (
          <VolumeX className="size-5 text-white" />
        ) : (
          <Volume2 className="size-5 text-white" />
        )}
      </button>

      {/* Bottom overlay: user info + caption */}
      <div
        className="absolute bottom-0 left-0 right-16 p-4 pb-6 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-2 pointer-events-auto">
          <UserAvatar
            src={reel.profiles.avatar_url}
            fallback={reel.profiles.display_name || reel.profiles.username}
            size="sm"
          />
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">
              {reel.profiles.display_name || reel.profiles.username}
            </span>
            <span className="text-white/60 text-xs">
              {formatTimeAgo(reel.created_at)}
            </span>
          </div>
        </div>
        {caption && (
          <div
            className="pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              setShowCaption(!showCaption);
            }}
          >
            <p className="text-white text-sm leading-relaxed">
              {showCaption ? caption : truncatedCaption}
            </p>
            {caption.length > 100 && (
              <button className="text-white/60 text-xs mt-1">
                {showCaption ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right side actions */}
      <div
        className="absolute bottom-24 right-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <ReelActions
          postId={reel.id}
          likeCount={reel.like_count}
          commentCount={reel.comment_count}
          bookmarkCount={reel.bookmark_count}
          isLiked={reel.user_has_liked ?? false}
          isBookmarked={reel.user_has_bookmarked ?? false}
        />
      </div>
    </div>
  );
}
