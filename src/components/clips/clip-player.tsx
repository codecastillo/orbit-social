"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Volume2, VolumeX, Play } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatTimeAgo } from "@/lib/utils/format";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedStar } from "@/components/orbit/verified-star";
import { ClipActions } from "./clip-actions";
import { ClipCommentsSheet } from "./clip-comments-sheet";
import { useAuth } from "@/lib/hooks/use-auth";
import { checkFollowing, followUser, unfollowUser } from "@/lib/queries/social";
import { O, aurora } from "@/lib/design/orbit";
import type { PostWithAuthor } from "@/lib/queries/posts";

interface ClipPlayerProps {
  clip: PostWithAuthor;
}

export function ClipPlayer({ clip }: ClipPlayerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showCaption, setShowCaption] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0); // 0–1
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

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to follow people");
      return;
    }
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

  return (
    <div
      ref={containerRef}
      className="relative h-dvh w-full snap-start flex items-center justify-center overflow-hidden"
      style={{ background: O.bg }}
      onClick={togglePlay}
    >
      {/* Phone-sized player frame — caps width so ultra-wide desktops don't
          stretch a 9:16 video into a giant slab. Anything outside the frame
          stays as the ambient O.bg backdrop. */}
      <div
        className="relative h-full overflow-hidden"
        style={{
          width: "min(100%, 440px)",
          aspectRatio: "9 / 16",
          maxHeight: "100%",
          borderRadius: 0,
        }}
      >
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
        <div style={{ color: O.ink3, fontSize: 13 }}>Video unavailable</div>
      )}

      {/* Aurora ambient scrims for legibility — subtle, not distracting */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(7,8,24,0.55) 0%, rgba(7,8,24,0) 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-64 pointer-events-none"
        style={{
          background:
            `linear-gradient(to top, rgba(7,8,24,0.85) 0%, rgba(7,8,24,0.45) 35%, rgba(7,8,24,0) 100%)`,
        }}
      />

      {/* Play indicator (paused state) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(10,12,28,0.55)",
              backdropFilter: "blur(14px) saturate(160%)",
              WebkitBackdropFilter: "blur(14px) saturate(160%)",
              border: `1px solid ${O.hair2}`,
              display: "grid",
              placeItems: "center",
              boxShadow: `0 12px 40px -12px ${O.a1}66`,
            }}
          >
            <Play
              style={{ width: 30, height: 30, color: O.ink, fill: O.ink, marginLeft: 3 }}
            />
          </div>
        </div>
      )}

      {/* Mute toggle — top right, glass pill */}
      <button
        onClick={toggleMute}
        className="absolute top-5 right-5 z-10"
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "rgba(10,12,28,0.55)",
          backdropFilter: "blur(14px) saturate(160%)",
          WebkitBackdropFilter: "blur(14px) saturate(160%)",
          border: `1px solid ${O.hair}`,
          display: "grid",
          placeItems: "center",
          color: O.ink,
        }}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <VolumeX style={{ width: 18, height: 18 }} strokeWidth={2} />
        ) : (
          <Volume2 style={{ width: 18, height: 18 }} strokeWidth={2} />
        )}
      </button>

      {/* Bottom overlay: author + caption */}
      <div
        className="absolute bottom-0 left-0 right-20 px-5 pb-7 pt-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <Link
            href={`/${author.username}`}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <UserAvatar
              src={author.avatar_url}
              fallback={author.display_name || author.username}
              size="md"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontFamily: O.sans,
                    fontSize: 14,
                    fontWeight: 700,
                    color: O.ink,
                    letterSpacing: "-0.005em",
                    textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  }}
                >
                  {author.display_name || author.username}
                </span>
                {author.is_verified && <VerifiedStar size={12} />}
              </div>
              <span
                style={{
                  fontFamily: O.sans,
                  fontSize: 11,
                  color: O.ink3,
                  fontFeatureSettings: '"tnum"',
                }}
              >
                @{author.username} · {formatTimeAgo(clip.created_at)}
              </span>
            </div>
          </Link>
          {!isSelf && user && (
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              style={{
                marginLeft: 4,
                padding: "6px 14px",
                borderRadius: 999,
                fontFamily: O.sans,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.01em",
                color: isFollowing ? O.ink : O.bg,
                background: isFollowing ? "rgba(255,255,255,0.08)" : aurora,
                border: isFollowing
                  ? `1px solid ${O.hair2}`
                  : "1px solid rgba(255,255,255,0.2)",
                backdropFilter: isFollowing ? "blur(12px)" : undefined,
                cursor: followBusy ? "default" : "pointer",
                opacity: followBusy ? 0.65 : 1,
                boxShadow: isFollowing ? "none" : `0 6px 20px -8px ${O.a2}`,
              }}
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
            style={{
              cursor: caption.length > 110 ? "pointer" : "default",
            }}
          >
            <p
              style={{
                fontFamily: O.sans,
                color: O.ink,
                fontSize: 13.5,
                lineHeight: 1.5,
                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {showCaption ? caption : truncatedCaption}
            </p>
            {caption.length > 110 && (
              <span
                style={{
                  fontFamily: O.sans,
                  color: O.ink3,
                  fontSize: 11,
                  marginTop: 4,
                  display: "inline-block",
                }}
              >
                {showCaption ? "Show less" : "Show more"}
              </span>
            )}
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
          isLiked={clip.user_has_liked ?? false}
          isBookmarked={clip.user_has_bookmarked ?? false}
          onComment={() => setCommentsOpen(true)}
        />
      </div>

      {/* Scrub bar — TikTok-style thin progress at the very bottom of the
          player frame. Click to seek. */}
      <div
        className="absolute left-0 right-0 z-20"
        onClick={handleScrub}
        style={{
          bottom: 0,
          height: 14,
          paddingBottom: 4,
          display: "flex",
          alignItems: "flex-end",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: "100%",
            height: 2.5,
            background: "rgba(255,255,255,0.18)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: aurora,
              transition: "width 120ms linear",
            }}
          />
        </div>
      </div>

      {/* Comments side sheet — opens over the player without pausing video */}
      <ClipCommentsSheet
        postId={clip.id}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />
      </div>
    </div>
  );
}
