"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Volume2, VolumeX, Play, ChevronUp, ChevronDown } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatTimeAgo } from "@/lib/utils/format";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedStar } from "@/components/orbit/verified-star";
import { ClipActions } from "./clip-actions";
import { ClipCommentsSheet } from "./clip-comments-sheet";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { checkFollowing, followUser, unfollowUser } from "@/lib/queries/social";
import { createClient } from "@/lib/supabase/client";
import { useUIStore } from "@/lib/stores/ui-store";
import type { PostWithAuthor } from "@/lib/queries/posts";

interface ClipPlayerProps {
  clip: PostWithAuthor;
  onNavigate?: (dir: 1 | -1) => void;
}

export function ClipPlayer({ clip, onNavigate }: ClipPlayerProps) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isMuted = useUIStore((s) => s.clipsMuted);
  const setClipsMuted = useUIStore((s) => s.setClipsMuted);
  const [showCaption, setShowCaption] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [commentsOpen, setCommentsOpen] = useState(false);

  const videoUrl = clip.post_media?.[0]?.url;
  const author = clip.profiles;
  const isSelf = user?.id === author.id;

  const { data: followingSet } = useQuery({
    queryKey: ["follow-status", user?.id, author.id],
    queryFn: () =>
      user ? checkFollowing(user.id, [author.id]) : new Set<string>(),
    enabled: !!user && !isSelf,
    staleTime: 30_000,
  });

  const isFollowing =
    followOverride ?? followingSet?.has(author.id) ?? false;

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

    const onTime = () => {
      if (video.duration > 0) setProgress(video.currentTime / video.duration);
    };
    video.addEventListener("timeupdate", onTime);

    return () => {
      observer.disconnect();
      video.removeEventListener("timeupdate", onTime);
    };
  }, []);

  // Realtime: react to count changes (like/comment/share) on this clip
  // and to new replies under this clip without requiring a refresh.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`clip-${clip.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "posts",
          filter: `id=eq.${clip.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["clips"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_likes",
          filter: `post_id=eq.${clip.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["clips"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `reply_to_id=eq.${clip.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["clip-comments", clip.id] });
          queryClient.invalidateQueries({ queryKey: ["clips"] });
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [clip.id, queryClient]);

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
    setProgress(ratio);
  };

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

  const toggleMute = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setClipsMuted(!isMuted);
    },
    [isMuted, setClipsMuted],
  );

  // Apply the shared mute state to this video element whenever it changes.
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  const toggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!requireAuth() || !user) return;
    const wasFollowing = isFollowing;
    setFollowOverride(!wasFollowing);
    setFollowBusy(true);
    try {
      if (wasFollowing) {
        await unfollowUser(user.id, author.id);
      } else {
        await followUser(user.id, author.id);
      }
      queryClient.invalidateQueries({
        queryKey: ["follow-status", user.id, author.id],
      });
    } catch {
      setFollowOverride(wasFollowing);
      toast.error("Couldn't update follow");
    } finally {
      setFollowBusy(false);
    }
  };

  const caption = clip.content || "";
  const truncatedCaption =
    caption.length > 110 ? caption.slice(0, 110).trimEnd() + "…" : caption;
  const renderCaption = (text: string) => {
    // Split on #hashtags and render them as colored links to /hashtag/<tag>.
    // Tag chars: letters, digits, underscores. Stops at whitespace or punctuation.
    const parts = text.split(/(#[\p{L}0-9_]+)/gu);
    return parts.map((part, i) => {
      if (part.startsWith("#") && part.length > 1) {
        const tag = part.slice(1).toLowerCase();
        return (
          <Link
            key={i}
            href={`/hashtag/${encodeURIComponent(tag)}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-primary no-underline"
          >
            {part}
          </Link>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full snap-start flex items-center justify-center overflow-hidden gap-4 bg-black"
      onClick={togglePlay}
    >
      {/* Up/down nav arrows pinned to the LEFT of the player frame so
          they shift with the video when the comments side panel opens
          (instead of overlapping the video at viewport-center). */}
      {onNavigate && (
        <div
          className="hidden lg:flex shrink-0 flex-col gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <ClipNavArrow
            direction="up"
            onClick={() => onNavigate(-1)}
          />
          <ClipNavArrow
            direction="down"
            onClick={() => onNavigate(1)}
          />
        </div>
      )}
      {/* Phone-sized player frame, height-driven so the whole 9:16 frame
          (including the bottom scrub bar + caption + action rail) always
          fits in the viewport with no scroll required. Width derives from
          height via aspect-ratio. Capped at 720px tall / 440px wide so it
          stays phone-sized on tall ultra-wide displays. */}
      <div
        className="relative shrink-0"
        style={{
          height: "min(100% - 24px, 720px)",
          maxWidth: "94vw",
          aspectRatio: "9 / 16",
        }}
      >
      <div className="relative h-full w-full overflow-hidden rounded-[18px]">
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-cover"
          loop
          muted
          playsInline
          preload="metadata"
          poster={clip.post_media?.[0]?.thumbnail_url || undefined}
        />
      ) : (
        <div className="text-[13px] text-white/60">Video unavailable</div>
      )}

      {/* Ambient scrims for legibility, subtle, not distracting */}
      <div className="absolute inset-x-0 top-0 h-32 pointer-events-none bg-gradient-to-b from-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-64 pointer-events-none bg-gradient-to-t from-black/85 via-black/45 via-35% to-transparent" />

      {/* Play indicator (paused state) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-white/15 bg-black/60">
            <Play className="ml-[3px] h-[30px] w-[30px] fill-white text-white" />
          </div>
        </div>
      )}

      {/* Mute toggle, top right */}
      <button
        onClick={toggleMute}
        className="absolute top-5 right-5 z-10 grid h-[38px] w-[38px] place-items-center rounded-full border border-white/15 bg-black/60 text-white"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <VolumeX className="h-[18px] w-[18px]" strokeWidth={2} />
        ) : (
          <Volume2 className="h-[18px] w-[18px]" strokeWidth={2} />
        )}
      </button>

      {/* Bottom overlay: author + caption */}
      <div
        className="absolute bottom-0 left-0 right-20 px-5 pb-7 pt-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <Link href={`/${author.username}`} className="flex items-center gap-2.5">
            <UserAvatar
              src={author.avatar_url}
              fallback={author.display_name || author.username}
              size="md"
            />
            <div className="flex flex-col gap-px">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-[-0.005em] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
                  {author.display_name || author.username}
                </span>
                {author.is_verified && <VerifiedStar size={12} />}
              </div>
              <span className="text-[11px] text-white/60 tabular-nums">
                @{author.username} · {formatTimeAgo(clip.created_at)}
              </span>
            </div>
          </Link>
          {!isSelf && user && (
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={`ml-1 rounded-full px-3.5 py-1.5 text-xs font-bold tracking-[0.01em] cursor-pointer disabled:cursor-default disabled:opacity-65 ${
                isFollowing
                  ? "border border-white/15 bg-white/10 text-white"
                  : "border border-white/20 bg-primary text-white"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}
        </div>
        {caption && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (caption.length > 110) setShowCaption(!showCaption);
            }}
            className={caption.length > 110 ? "cursor-pointer" : "cursor-default"}
          >
            <p className="text-[13.5px] leading-normal text-white whitespace-pre-wrap break-words [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
              {renderCaption(
                showCaption || caption.length <= 110 ? caption : truncatedCaption,
              )}
              {caption.length > 110 && (
                <>
                  {" "}
                  <span className="cursor-pointer text-[13px] font-semibold text-white/60">
                    {showCaption ? "less" : "more"}
                  </span>
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Right action rail */}
      <div
        className="absolute bottom-7 right-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <ClipActions
          postId={clip.id}
          likeCount={clip.like_count}
          commentCount={clip.comment_count}
          bookmarkCount={clip.bookmark_count}
          shareCount={clip.share_count ?? 0}
          isLiked={clip.user_has_liked ?? false}
          isBookmarked={clip.user_has_bookmarked ?? false}
          onComment={() => setCommentsOpen(true)}
        />
      </div>

      {/* Scrub bar, TikTok-style thin progress flush with the bottom
          edge of the player frame. Click to seek. The hit area is taller
          than the visual bar so it's easy to grab on touch. */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex h-3 items-end cursor-pointer"
        onClick={handleScrub}
      >
        <div className="h-[3px] w-full overflow-hidden bg-white/20">
          <div
            className="h-full bg-primary transition-[width] duration-[120ms] ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      </div>
      </div>

      {/* Comments side panel, sibling of the player frame so the video
          stays fully visible while you scroll/reply. Hidden when closed.
          When open, the flex layout naturally compresses the player frame
          to its left, so the nav arrows on the FAR left shift with it. */}
      {commentsOpen && (
        <div
          className="shrink-0"
          style={{
            width: "min(94vw, 380px)",
            height: "min(100%, 720px)",
            maxHeight: "100%",
            aspectRatio: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ClipCommentsSheet
            postId={clip.id}
            onClose={() => setCommentsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function ClipNavArrow({
  direction,
  onClick,
}: {
  direction: "up" | "down";
  onClick: () => void;
}) {
  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={direction === "up" ? "Previous clip" : "Next clip"}
      className="grid h-[38px] w-[38px] cursor-pointer place-items-center rounded-full border border-white/15 bg-black/60 text-white"
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
    </button>
  );
}
