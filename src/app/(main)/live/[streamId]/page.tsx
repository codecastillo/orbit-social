"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Send, Share2, X, Gift, Eye, Sparkles, Pencil, Check } from "lucide-react";
import * as Icons from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useStreamPresence } from "@/lib/hooks/use-stream-presence";
import { useStreamHearts } from "@/lib/hooks/use-stream-hearts";
import { createClient } from "@/lib/supabase/client";
import { getStreamById, type LiveStreamWithProfile } from "@/lib/queries/live";
import { sendGift, type SentGift } from "@/lib/queries/gifts";
import {
  followUser,
  unfollowUser,
  checkFollowing,
} from "@/lib/queries/social";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { VerifiedStar } from "@/components/orbit/verified-star";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GiftAnimation } from "@/components/live/gift-animation";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { LIVE_CATEGORIES } from "@/lib/constants/live-categories";
import {
  LIVE_GAMES_BY_SLUG,
  coverArtSmallUrl,
  isLiveGameSlug,
} from "@/lib/constants/live-games";
import { CategoryPickerDialog } from "@/components/live/category-picker-dialog";
import { getMuxLiveThumbnailUrl } from "@/lib/services/mux";

const CATEGORY_LOOKUP: Record<string, (typeof LIVE_CATEGORIES)[number]> =
  Object.fromEntries(LIVE_CATEGORIES.map((c) => [c.slug, c]));

function stripUndef<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k in obj) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out as Partial<T>;
}

function resolveLucideIcon(name: string) {
  const lookup = Icons as unknown as Record<
    string,
    React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
  >;
  return lookup[name] ?? Sparkles;
}

const MuxPlayer = dynamic(() => import("@mux/mux-player-react").then((m) => m.default), {
  ssr: false,
});

interface Props {
  params: Promise<{ streamId: string }>;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  content: string;
  timestamp: number;
}

function useLiveChat(streamId: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live-chat:${streamId}`);

    channel
      .on("broadcast", { event: "chat-message" }, (payload) => {
        const msg = payload.payload as ChatMessage;
        setMessages((prev) => [...prev, msg]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const sendMessage = useCallback(
    async (content: string): Promise<{ ok: true } | { ok: false }> => {
      const trimmed = content.trim();
      if (!user || !trimmed) return { ok: false };
      try {
        const res = await fetch(`/api/live/${streamId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        });
        if (res.ok) return { ok: true };
        let body: { error?: string; retry_after?: number } = {};
        try {
          body = (await res.json()) as { error?: string; retry_after?: number };
        } catch {}
        if (res.status === 403 && body.error === "followers_only") {
          toast.error("Only followers can chat in this stream");
        } else if (res.status === 429 && body.error === "slow_mode") {
          const wait = body.retry_after ?? 0;
          toast.error(`Slow mode, wait ${wait}s`);
        } else if (res.status === 410 && body.error === "stream_not_live") {
          toast.error("Stream isn't live");
        } else {
          toast.error("Couldn't send");
        }
        return { ok: false };
      } catch {
        toast.error("Couldn't send");
        return { ok: false };
      }
    },
    [user, streamId],
  );

  return { messages, sendMessage };
}

function useLiveClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatElapsed(iso: string | null, now: number): string {
  if (!iso) return "00:00";
  const sec = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${(m % 60).toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const MUX_PLAYER_STYLE = {
  "--media-live-button": "none",
  "--top-live-button": "none",
  "--media-pip-button": "none",
  "--media-object-fit": "contain",
  width: "100%",
  height: "100%",
} as React.CSSProperties & Record<string, string>;

export default function LiveViewerPage({ params }: Props) {
  const { streamId } = use(params);
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: stream } = useQuery({
    queryKey: ["live-stream", streamId],
    queryFn: () => getStreamById(streamId),
    // 30s instead of 10s: chat + hearts already arrive via realtime, the
    // poll is only here as a metadata safety net.
    refetchInterval: 30000,
  });

  const { messages, sendMessage } = useLiveChat(streamId);
  const now = useLiveClock();

  const isOwnStream = !!user && !!stream && user.id === stream.user_id;
  const canShowFollow = !!user && !!stream && !isOwnStream;

  const { count: viewerCount } = useStreamPresence(streamId, {
    isStreamer: isOwnStream,
    userId: user?.id ?? null,
  });

  const followQueryKey = ["live-follow", user?.id, stream?.user_id];
  const { data: isFollowing = false } = useQuery({
    queryKey: followQueryKey,
    queryFn: async () => {
      if (!user || !stream) return false;
      const set = await checkFollowing(user.id, [stream.user_id]);
      return set.has(stream.user_id);
    },
    enabled: canShowFollow,
  });

  const followMutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!user || !stream) throw new Error("not ready");
      if (next) await followUser(user.id, stream.user_id);
      else await unfollowUser(user.id, stream.user_id);
    },
    onMutate: async (next: boolean) => {
      await queryClient.cancelQueries({ queryKey: followQueryKey });
      const prev = queryClient.getQueryData<boolean>(followQueryKey);
      queryClient.setQueryData(followQueryKey, next);
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(followQueryKey, ctx.prev);
      }
      toast.error("Something went wrong");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: followQueryKey });
    },
  });

  const handleToggleFollow = useCallback(async () => {
    if (!requireAuth() || !user) return;
    await followMutation.mutateAsync(!isFollowing);
  }, [followMutation, isFollowing, requireAuth, user]);

  const [comment, setComment] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [activeGifts, setActiveGifts] = useState<SentGift[]>([]);

  const { hearts, totalCount: likeCount, sendHeart } = useStreamHearts(streamId);

  const handleHeartZoneTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (uiHidden) {
      setUiHidden(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    sendHeart(xPct, yPct);
  };

  const handleSend = async () => {
    if (!requireAuth() || !user) return;
    if (!comment.trim()) return;
    const result = await sendMessage(comment.trim());
    if (result.ok) setComment("");
  };

  const handleTip = () => {
    if (!requireAuth() || !user) return;
    try {
      const sent = sendGift(streamId, user.id, "star");
      setActiveGifts((g) => [...g, sent]);
    } catch {
      toast.error("Failed to send");
    }
  };

  if (!stream) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden lg:flex lg:bg-[#0a0a12]">
      {/* Left column. Mobile: phone-aspect viewport with TikTok overlay chrome. Desktop: video + info bar stacked. */}
      <div className="relative h-[100dvh] max-w-md mx-auto bg-zinc-950 overflow-hidden lg:max-w-none lg:flex-1 lg:mx-0 lg:flex lg:flex-col lg:bg-transparent">
        {/* Desktop video column wrapper (lg+ only) */}
        <div className="hidden lg:flex lg:flex-1 lg:min-h-0 lg:p-5 lg:pb-3">
          <div className="relative flex-1 rounded-2xl overflow-hidden border border-white/[0.08] bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
            {stream.mux_playback_id ? (
              <MuxPlayer
                streamType="live"
                playbackId={stream.mux_playback_id}
                autoPlay
                muted={false}
                disablePictureInPicture
                poster={
                  stream.status === "live"
                    ? getMuxLiveThumbnailUrl(stream.mux_playback_id, {
                        sessionStartedAt: stream.started_at,
                      })
                    : ""
                }
                style={MUX_PLAYER_STYLE}
                metadata={{
                  video_id: stream.id,
                  video_title: stream.title ?? undefined,
                  viewer_user_id: user?.id ?? undefined,
                }}
              />
            ) : (
              <PlaceholderCover stream={stream} />
            )}
          </div>
        </div>

        {/* Mobile video layer (full-bleed, behind chrome). */}
        <div className="absolute inset-0 select-none lg:hidden">
          {stream.mux_playback_id ? (
            <MuxPlayer
              streamType="live"
              playbackId={stream.mux_playback_id}
              autoPlay
              muted={false}
              disablePictureInPicture
              poster={
                stream.status === "live"
                  ? getMuxLiveThumbnailUrl(stream.mux_playback_id, {
                      sessionStartedAt: stream.started_at,
                    })
                  : ""
              }
              style={MUX_PLAYER_STYLE}
              metadata={{
                video_id: stream.id,
                video_title: stream.title ?? undefined,
                viewer_user_id: user?.id ?? undefined,
              }}
            />
          ) : (
            <PlaceholderCover stream={stream} />
          )}
          {/* Top + bottom gradients for legibility */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        </div>

        {/* Mobile heart hit zone, right 30% of screen */}
        <div
          className="lg:hidden absolute top-0 right-0 bottom-0 w-[30%] z-[5]"
          onClick={handleHeartZoneTap}
        />

        {/* Global floating hearts (every viewer sees every heart) */}
        <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden">
          <AnimatePresence>
            {hearts.map((h) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                animate={{ opacity: 0, y: -200, scale: 1.2, x: (Math.random() - 0.5) * 80 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{
                  left: `${h.xPct * 100}%`,
                  top: `${h.yPct * 100}%`,
                }}
                className="absolute"
              >
                <Heart className="h-8 w-8 text-rose-500 fill-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.7)]" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Hidden-UI hint (mobile only) */}
        {uiHidden && (
          <div className="lg:hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 text-xs font-semibold uppercase tracking-wider pointer-events-none">
            Tap to show UI
          </div>
        )}

        {/* Mobile chrome (overlay) */}
        {!uiHidden && (
          <div className="lg:hidden">
            {/* Header, rounded-square chips */}
            <div className="absolute top-0 inset-x-0 p-4 flex items-start justify-between gap-3 z-10">
              <div className="flex items-start gap-2 min-w-0 flex-wrap">
                <div className="flex items-center gap-2 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/15 p-1.5 pr-3">
                  <UserAvatar
                    src={stream.profiles?.avatar_url ?? null}
                    fallback={stream.profiles?.display_name ?? "H"}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-white leading-tight truncate">
                      {stream.profiles?.display_name}
                    </p>
                    <p className="text-[11px] text-white/60 leading-tight truncate">
                      @{stream.profiles?.username}
                    </p>
                  </div>
                  {canShowFollow && (
                    <button
                      onClick={handleToggleFollow}
                      disabled={followMutation.isPending}
                      className={cn(
                        "ml-1 px-3 h-7 rounded-xl text-[11px] font-bold transition-colors",
                        isFollowing
                          ? "bg-white/[0.10] text-white border border-white/15"
                          : "bg-primary text-primary-foreground shadow-[0_0_12px_oklch(0.623_0.214_259_/_0.5)]"
                      )}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  )}
                </div>

                {(stream.category || stream.game_slug) && (
                  <MobileCategoryPill
                    slug={stream.category}
                    gameSlug={stream.game_slug}
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 px-2 h-7 rounded-xl bg-red-500 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </span>
                <span className="flex items-center gap-1 px-2 h-7 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white text-[11px] font-semibold tabular-nums">
                  <Eye className="h-3 w-3" />
                  {viewerCount}
                </span>
                <button
                  onClick={() => router.back()}
                  className="h-9 w-9 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Title strip */}
            <div className="absolute top-[72px] left-4 right-4 z-10">
              <h1 className="text-white text-[15px] font-bold leading-snug drop-shadow-md line-clamp-2">
                {stream.title}
              </h1>
            </div>

            {/* Chat overlay (mobile only) */}
            <div className="absolute left-4 right-20 bottom-[88px] max-h-[42%] overflow-y-auto scrollbar-hide z-10 space-y-1.5 pointer-events-none">
              <AnimatePresence initial={false}>
                {messages.slice(-25).map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 max-w-fit rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 px-3 py-1.5 pointer-events-auto"
                  >
                    <UserAvatar
                      src={m.avatarUrl}
                      fallback={m.displayName}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-white/90 leading-tight">
                        {m.displayName}
                      </p>
                      <p className="text-[13px] text-white leading-snug break-words">
                        {m.content}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Like burst counter (right), mobile only */}
            <div className="absolute right-4 bottom-[112px] z-10 flex flex-col items-center gap-1 pointer-events-none">
              <Heart className="h-5 w-5 text-rose-400 fill-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]" />
              <span className="text-white text-[12px] font-bold tabular-nums drop-shadow">
                {likeCount}
              </span>
            </div>

            {/* Footer: Tip / input / heart / share */}
            <div className="absolute bottom-0 inset-x-0 p-4 pb-[max(env(safe-area-inset-bottom),16px)] z-10 flex items-center gap-2">
              <button
                onClick={handleTip}
                className="flex-shrink-0 h-11 px-3.5 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white text-[13px] font-extrabold inline-flex items-center gap-1.5 shadow-[0_4px_16px_rgba(244,63,94,0.4)] active:scale-95 transition-transform"
              >
                <Gift className="h-4 w-4" />
                Tip
              </button>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={
                    stream.followers_only_chat
                      ? "Followers can chat"
                      : "Add comment…"
                  }
                  className="w-full h-11 pl-4 pr-11 rounded-2xl bg-white/[0.10] backdrop-blur-xl border border-white/15 text-white text-[14px] placeholder:text-white/55 focus:outline-none focus:border-primary/60 focus:bg-white/[0.14] transition-all"
                />
                {comment.trim() && (
                  <button
                    onClick={handleSend}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={() => sendHeart(0.85, 0.7)}
                className="flex-shrink-0 h-11 w-11 rounded-2xl bg-white/[0.10] backdrop-blur-xl border border-white/15 flex items-center justify-center text-rose-400 active:scale-90 transition-transform"
              >
                <Heart className="h-[18px] w-[18px] fill-current" />
              </button>

              <button
                onClick={() => setShareOpen(true)}
                className="flex-shrink-0 h-11 w-11 rounded-2xl bg-white/[0.10] backdrop-blur-xl border border-white/15 flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <Share2 className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        )}

        {/* Desktop info bar (lg+ only) */}
        <DesktopInfoBar
          stream={stream}
          now={now}
          viewerCount={viewerCount}
          canShowFollow={canShowFollow}
          isFollowing={isFollowing}
          onToggleFollow={handleToggleFollow}
          onShare={() => setShareOpen(true)}
          isOwnStream={isOwnStream}
          onSaveStream={async (patch) => {
            try {
              const res = await fetch("/api/live/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
              });
              if (!res.ok) throw new Error(`http_${res.status}`);
              queryClient.setQueryData<LiveStreamWithProfile>(
                ["live-stream", streamId],
                (prev) => (prev ? { ...prev, ...stripUndef(patch) } : prev),
              );
            } catch {
              toast.error("Couldn't save");
            }
          }}
        />

        {/* Gift overlay */}
        <GiftAnimation
          gifts={activeGifts}
          onComplete={(id) => setActiveGifts((g) => g.filter((x) => x.id !== id))}
        />
      </div>

      {/* Desktop chat rail */}
      <aside className="hidden lg:flex flex-col w-[380px] h-[100dvh] bg-[#0a0a12] border-l border-white/[0.08]">
        <div className="px-5 py-[18px] border-b border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-mono tracking-[0.12em] text-cyan-300/90">
            <span>◆</span>
            ROOM CHAT · {viewerCount} IN
          </div>
          <button
            onClick={() => router.back()}
            className="h-8 w-8 -mr-1 -mt-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-6">
              <div className="h-12 w-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white/40" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white/80">
                  No messages yet
                </p>
                <p className="text-[12px] text-white/40 mt-1 leading-relaxed">
                  Be the first to say hi.
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 group"
                >
                  <UserAvatar src={m.avatarUrl} fallback={m.displayName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-tight">
                      <span className="font-bold text-white">{m.displayName}</span>
                      <span className="text-white/35 font-normal ml-1">@{m.username}</span>
                    </p>
                    <p className="text-[14px] text-white/90 leading-snug break-words mt-0.5">
                      {m.content}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        <div className="border-t border-white/[0.08] p-3 bg-gradient-to-t from-white/[0.03] to-transparent">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTip}
              className="flex-shrink-0 h-10 px-3 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-white text-[12px] font-extrabold inline-flex items-center gap-1.5 shadow-[0_4px_16px_rgba(244,63,94,0.35)] hover:brightness-110 active:scale-95 transition-all"
            >
              <Gift className="h-4 w-4" />
              Tip
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={
                  stream.followers_only_chat
                    ? "Followers can chat"
                    : "Send a message"
                }
                className="w-full h-10 pl-4 pr-10 rounded-xl bg-white/[0.05] border border-white/10 text-white text-[13.5px] placeholder:text-white/40 focus:outline-none focus:border-cyan-400/40 focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08)] transition-all"
              />
              {comment.trim() && (
                <button
                  onClick={handleSend}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 text-white flex items-center justify-center shadow-[0_2px_8px_rgba(34,211,238,0.3)]"
                  aria-label="Send"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <DesktopLikeButton
              onLike={() => sendHeart(0.7 + Math.random() * 0.25, 0.6 + Math.random() * 0.3)}
              count={likeCount}
            />
          </div>
          {stream.slow_mode_seconds > 0 && (
            <p className="mt-2 text-[11px] text-white/45 leading-tight">
              Slow mode: 1 message per {stream.slow_mode_seconds}s.
            </p>
          )}
        </div>
      </aside>

      {/* Share sheet */}
      <Sheet open={shareOpen} onOpenChange={setShareOpen}>
        <SheetContent
          side="bottom"
          className="bg-popover border-t border-white/10 rounded-t-3xl px-5 pt-3 pb-[max(env(safe-area-inset-bottom),20px)] max-w-md mx-auto"
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-white/15 mb-4" />
          <SheetHeader>
            <SheetTitle className="text-base font-bold text-foreground">
              Share stream
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-3">
              Share to
            </p>
            <div className="grid grid-cols-4 gap-3">
              {["Copy link", "Message", "Story", "More"].map((label) => (
                <button
                  key={label}
                  className="flex flex-col items-center gap-2"
                  onClick={() => {
                    if (label === "Copy link") {
                      navigator.clipboard.writeText(window.location.href);
                      setShareOpen(false);
                    }
                  }}
                >
                  <div className="h-12 w-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-foreground">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-3">
              Stream options
            </p>
            <div className="space-y-1">
              {[
                { label: "Clear display", onClick: () => { setUiHidden(true); setShareOpen(false); } },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="w-full text-left h-12 px-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-sm font-semibold transition-colors text-foreground"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PlaceholderCover({ stream }: { stream: LiveStreamWithProfile }) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.35),transparent_55%),radial-gradient(circle_at_70%_70%,rgba(244,63,94,0.3),transparent_55%),linear-gradient(180deg,#0a0a14,#000)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center px-8">
        <div className="relative">
          <div className="absolute inset-0 -m-3 rounded-full bg-white/10 animate-pulse blur-xl" />
          <UserAvatar
            src={stream.profiles?.avatar_url ?? null}
            fallback={stream.profiles?.display_name ?? "·"}
            size="lg"
          />
        </div>
        <div>
          <p className="text-white text-lg font-bold">
            {stream.profiles?.display_name}
          </p>
          <p className="text-white/50 text-sm mt-0.5">
            Waiting for the broadcast to start…
          </p>
        </div>
      </div>
    </div>
  );
}

type StreamPatch = {
  title?: string;
  category?: string | null;
  game_slug?: string | null;
  tags?: string[];
};

function DesktopInfoBar({
  stream,
  now,
  viewerCount,
  canShowFollow,
  isFollowing,
  onToggleFollow,
  onShare,
  isOwnStream,
  onSaveStream,
}: {
  stream: LiveStreamWithProfile;
  now: number;
  viewerCount: number;
  canShowFollow: boolean;
  isFollowing: boolean;
  onToggleFollow: () => Promise<void>;
  onShare: () => void;
  isOwnStream: boolean;
  onSaveStream: (patch: StreamPatch) => Promise<void>;
}) {
  const profileHref = stream.profiles?.username ? `/${stream.profiles.username}` : "#";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showEditingHint, setShowEditingHint] = useState(isOwnStream);

  useEffect(() => {
    if (!isOwnStream) return;
    const id = setTimeout(() => setShowEditingHint(false), 4000);
    return () => clearTimeout(id);
  }, [isOwnStream]);

  return (
    <div className="hidden lg:block px-5 pb-5">
      {showEditingHint && (
        <div className="mb-2 text-[10px] font-mono tracking-[0.12em] text-cyan-300/80">
          ◆ EDITING AS @{stream.profiles?.username}
        </div>
      )}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          <Link
            href={profileHref}
            className="flex items-center gap-3 min-w-0 flex-1 group rounded-xl -m-1 p-1 hover:bg-white/[0.03] transition-colors"
          >
            <UserAvatar
              src={stream.profiles?.avatar_url ?? null}
              fallback={stream.profiles?.display_name ?? "H"}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-[16px] font-bold text-white leading-tight truncate group-hover:underline underline-offset-2">
                  {stream.profiles?.display_name}
                </p>
                {stream.profiles?.is_verified && <VerifiedStar size={14} />}
              </div>
              <p className="text-[12.5px] text-white/55 leading-tight truncate mt-0.5">
                @{stream.profiles?.username}
              </p>
            </div>
          </Link>

          {canShowFollow && (
            <FollowButton
              isFollowing={isFollowing}
              onToggle={onToggleFollow}
              size="sm"
            />
          )}

          <button
            onClick={onShare}
            className="flex-shrink-0 h-7 w-7 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/80 hover:bg-white/[0.08] hover:text-white transition-colors"
            aria-label="Share"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-1.5 pl-1">
            <span className="flex items-center gap-1 px-2 h-7 rounded-lg bg-red-500 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-[0_0_12px_rgba(239,68,68,0.45)]">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
            {stream.language && (
              <span className="px-2 h-7 inline-flex items-center rounded-lg bg-white/[0.05] border border-white/10 text-white/85 text-[10.5px] font-mono uppercase tracking-wider">
                {stream.language}
              </span>
            )}
            <span className="flex items-center gap-1 px-2 h-7 rounded-lg bg-white/[0.05] border border-white/10 text-white/85 text-[11.5px] font-semibold tabular-nums">
              <Eye className="h-3 w-3" />
              {viewerCount}
            </span>
            <span className="px-2 h-7 inline-flex items-center rounded-lg bg-white/[0.05] border border-white/10 text-white/85 text-[11.5px] font-mono tabular-nums">
              {formatElapsed(stream.started_at, now)}
            </span>
          </div>
        </div>

        <InlineTitleField
          title={stream.title}
          isOwnStream={isOwnStream}
          onSave={(t) => onSaveStream({ title: t })}
        />

        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <CategoryPill
            slug={stream.category}
            gameSlug={stream.game_slug}
            onClick={isOwnStream ? () => setPickerOpen(true) : undefined}
          />
          {stream.tags?.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center h-6 pl-2 ${
                isOwnStream ? "pr-1 group" : "pr-2"
              } rounded-md bg-white/[0.05] border border-white/10 text-white/70 text-[11px] font-semibold`}
            >
              #{tag}
              {isOwnStream && (
                <button
                  onClick={() =>
                    onSaveStream({ tags: (stream.tags ?? []).filter((t) => t !== tag) })
                  }
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {isOwnStream && (stream.tags?.length ?? 0) < 5 && (
            <InlineAddTag
              tags={stream.tags ?? []}
              onSave={(tags) => onSaveStream({ tags })}
            />
          )}
        </div>

        {isOwnStream && (
          <CategoryPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            value={{ category: stream.category, gameSlug: stream.game_slug }}
            onSave={(next) =>
              onSaveStream({ category: next.category, game_slug: next.gameSlug })
            }
          />
        )}
      </div>
    </div>
  );
}

function InlineTitleField({
  title,
  isOwnStream,
  onSave,
}: {
  title: string | null;
  isOwnStream: boolean;
  onSave: (t: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? "");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(title ?? "");
  }, [title]);

  const commit = async () => {
    const next = draft.trim().slice(0, 100);
    if (!next || next === (title ?? "")) {
      setEditing(false);
      return;
    }
    await onSave(next);
    setSavedFlash(true);
    setEditing(false);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  if (!isOwnStream) {
    return title ? (
      <h1 className="text-white text-[19px] font-bold leading-snug mt-3 line-clamp-2">
        {title}
      </h1>
    ) : null;
  }

  if (editing) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <input
          autoFocus
          value={draft}
          maxLength={100}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") {
              setDraft(title ?? "");
              setEditing(false);
            }
          }}
          onBlur={() => void commit()}
          className="flex-1 text-white text-[19px] font-bold leading-snug bg-transparent border-b border-cyan-400/40 focus:border-cyan-400 outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className="mt-3 group relative cursor-text rounded-md -mx-1 px-1 py-0.5 hover:bg-white/[0.03] hover:outline hover:outline-1 hover:outline-dashed hover:outline-cyan-400/30"
      onClick={() => setEditing(true)}
    >
      <h1 className="text-white text-[19px] font-bold leading-snug line-clamp-2">
        {title || (
          <span className="text-white/40 italic font-normal">Add a stream title…</span>
        )}
      </h1>
      <Pencil className="absolute top-1 right-1 h-3.5 w-3.5 text-cyan-300/70 opacity-0 group-hover:opacity-100 transition-opacity" />
      {savedFlash && (
        <span className="absolute -top-1 right-0 text-[10px] font-mono text-cyan-300 inline-flex items-center gap-1">
          <Check className="h-3 w-3" /> Saved
        </span>
      )}
    </div>
  );
}

function InlineAddTag({
  tags,
  onSave,
}: {
  tags: string[];
  onSave: (tags: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const commit = async () => {
    const cleaned = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 20);
    if (cleaned && !tags.some((t) => t.toLowerCase() === cleaned) && tags.length < 5) {
      await onSave([...tags, cleaned]);
    }
    setValue("");
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-white/[0.04] border border-dashed border-white/15 text-white/55 text-[11px] font-semibold hover:text-white hover:border-cyan-400/40 transition-colors"
      >
        + Add tag
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={value}
      maxLength={20}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") void commit();
        if (e.key === "Escape") {
          setValue("");
          setEditing(false);
        }
      }}
      onBlur={() => void commit()}
      placeholder="tag…"
      className="h-6 px-2 rounded-md bg-white/[0.06] border border-cyan-400/40 text-white text-[11px] font-semibold outline-none w-24"
    />
  );
}

function CategoryPill({
  slug,
  gameSlug,
  onClick,
}: {
  slug: string | null;
  gameSlug: string | null;
  onClick?: () => void;
}) {
  const game = gameSlug && isLiveGameSlug(gameSlug) ? LIVE_GAMES_BY_SLUG[gameSlug] : null;
  const cat = slug ? CATEGORY_LOOKUP[slug] : null;
  if (!game && !cat) {
    if (!onClick) return null;
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-bold bg-white/[0.04] border border-dashed border-white/15 text-white/55 hover:text-white hover:border-cyan-400/40 transition-colors"
      >
        <Sparkles className="h-3 w-3" />
        Add category
      </button>
    );
  }
  if (game) {
    const Wrapper: React.ElementType = onClick ? "button" : "span";
    return (
      <Wrapper
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 h-6 pl-1 pr-2.5 rounded-md text-[11px] font-bold border ${
          onClick ? "cursor-pointer hover:ring-2 hover:ring-cyan-400/30" : ""
        }`}
        style={{
          background: `oklch(0.4 0.18 ${game.accentHue} / 0.22)`,
          color: `oklch(0.88 0.14 ${game.accentHue})`,
          borderColor: `oklch(0.6 0.18 ${game.accentHue} / 0.4)`,
        }}
      >
        <img
          src={coverArtSmallUrl(game.slug)}
          alt=""
          width={14}
          height={18}
          className="rounded-sm object-cover"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
        />
        {game.label}
      </Wrapper>
    );
  }
  if (cat) {
    const Icon = resolveLucideIcon(cat.iconName);
    const Wrapper: React.ElementType = onClick ? "button" : "span";
    return (
      <Wrapper
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-bold border ${
          onClick ? "cursor-pointer hover:ring-2 hover:ring-cyan-400/30" : ""
        }`}
        style={{
          background: `oklch(0.55 0.18 ${cat.hue} / 0.22)`,
          color: `oklch(0.85 0.16 ${cat.hue})`,
          borderColor: `oklch(0.65 0.18 ${cat.hue} / 0.4)`,
        }}
      >
        <Icon size={11} />
        {cat.label}
      </Wrapper>
    );
  }
  return null;
}

function MobileCategoryPill({
  slug,
  gameSlug,
}: {
  slug: string | null;
  gameSlug: string | null;
}) {
  const game = gameSlug && isLiveGameSlug(gameSlug) ? LIVE_GAMES_BY_SLUG[gameSlug] : null;
  const cat = slug ? CATEGORY_LOOKUP[slug] : null;
  if (game) {
    return (
      <span
        className="inline-flex items-center gap-1 h-7 pl-1 pr-2.5 rounded-xl backdrop-blur-md text-[11px] font-bold border text-white"
        style={{
          background: `oklch(0.4 0.18 ${game.accentHue} / 0.4)`,
          borderColor: `oklch(0.65 0.18 ${game.accentHue} / 0.5)`,
        }}
      >
        <img
          src={coverArtSmallUrl(game.slug)}
          alt=""
          width={16}
          height={20}
          className="rounded-sm object-cover"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
        />
        {game.label}
      </span>
    );
  }
  if (!cat) return null;
  const Icon = resolveLucideIcon(cat.iconName);
  return (
    <span
      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-xl backdrop-blur-md text-[11px] font-bold text-white"
      style={{
        background: `oklch(0.55 0.18 ${cat.hue} / 0.32)`,
        border: `1px solid oklch(0.7 0.16 ${cat.hue} / 0.5)`,
      }}
    >
      <Icon size={12} />
      {cat.label}
    </span>
  );
}

function DesktopLikeButton({ onLike, count }: { onLike: () => void; count: number }) {
  const [bursts, setBursts] = useState<number[]>([]);
  const idRef = useRef(0);

  const handleClick = () => {
    onLike();
    const id = idRef.current++;
    setBursts((b) => [...b, id]);
    setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 1100);
  };

  return (
    <button
      onClick={handleClick}
      className="relative flex-shrink-0 h-10 px-3 rounded-xl bg-rose-500/10 border border-rose-500/20 inline-flex items-center gap-1.5 text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/30 active:scale-90 transition-all overflow-visible"
      aria-label="Like"
    >
      <Heart className="h-[16px] w-[16px] fill-current" />
      <span className="text-[12px] font-bold tabular-nums text-rose-300">{count}</span>
      <AnimatePresence>
        {bursts.map((id) => (
          <motion.span
            key={id}
            initial={{ opacity: 1, y: 0, scale: 0.6 }}
            animate={{ opacity: 0, y: -42, scale: 1.1, x: (Math.random() - 0.5) * 18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute left-1/2 top-0 -translate-x-1/2 pointer-events-none"
          >
            <Heart className="h-5 w-5 text-rose-500 fill-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
          </motion.span>
        ))}
      </AnimatePresence>
    </button>
  );
}
