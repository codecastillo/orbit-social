"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Heart, Send, Share2, X, Gift, Eye, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { getStreamById } from "@/lib/queries/live";
import { sendGift, type SentGift } from "@/lib/queries/gifts";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GiftAnimation } from "@/components/live/gift-animation";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ streamId: string }>;
}

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
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
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live-chat:${streamId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "chat-message" }, (payload) => {
        const msg = payload.payload as ChatMessage;
        setMessages((prev) => [...prev, msg]);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || !channelRef.current || !content.trim()) return;
      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", user.id)
        .single();

      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        userId: user.id,
        username: profile?.username ?? "user",
        displayName: profile?.display_name ?? "User",
        avatarUrl: profile?.avatar_url ?? null,
        content: content.trim(),
        timestamp: Date.now(),
      };

      await channelRef.current.send({
        type: "broadcast",
        event: "chat-message",
        payload: msg,
      });
    },
    [user]
  );

  return { messages, sendMessage };
}

export default function LiveViewerPage({ params }: Props) {
  const { streamId } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const { data: stream } = useQuery({
    queryKey: ["live-stream", streamId],
    queryFn: () => getStreamById(streamId),
    refetchInterval: 10000,
  });

  const { messages, sendMessage } = useLiveChat(streamId);

  const [comment, setComment] = useState("");
  const [likeCount, setLikeCount] = useState(0);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [activeGifts, setActiveGifts] = useState<SentGift[]>([]);
  const heartIdRef = useRef(0);

  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (uiHidden) {
      setUiHidden(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = heartIdRef.current++;
    setHearts((h) => [...h, { id, x, y }]);
    setLikeCount((c) => c + 1);
    setTimeout(() => setHearts((h) => h.filter((p) => p.id !== id)), 1400);
  };

  const handleSend = async () => {
    if (!user || !comment.trim()) return;
    await sendMessage(comment.trim());
    setComment("");
  };

  const handleTip = () => {
    if (!user) return;
    try {
      const sent = sendGift(streamId, user.id, "star");
      setActiveGifts((g) => [...g, sent]);
      toast.success("Sent");
    } catch {
      toast.error("Failed to send");
    }
  };

  if (!stream) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Phone-aspect viewport */}
      <div className="relative h-[100dvh] max-w-md mx-auto bg-zinc-950 overflow-hidden">
        {/* Video / cover */}
        <div
          className="absolute inset-0 cursor-pointer select-none"
          onClick={handleVideoTap}
        >
          <div className="w-full h-full bg-gradient-to-br from-violet-900/40 via-zinc-900 to-rose-900/40" />
          {/* Top + bottom gradients for legibility */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        </div>

        {/* Floating hearts */}
        <AnimatePresence>
          {hearts.map((h) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 1, y: 0, scale: 0.6 }}
              animate={{ opacity: 0, y: -180, scale: 1.2, x: (Math.random() - 0.5) * 80 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              style={{ left: h.x, top: h.y, pointerEvents: "none" }}
              className="absolute"
            >
              <Heart className="h-9 w-9 text-rose-500 fill-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.7)]" />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Hidden-UI hint */}
        {uiHidden && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 text-xs font-semibold uppercase tracking-wider pointer-events-none">
            Tap to show UI
          </div>
        )}

        {/* Chrome */}
        {!uiHidden && (
          <>
            {/* Header — rounded-square chips */}
            <div className="absolute top-0 inset-x-0 p-4 flex items-start justify-between gap-3 z-10">
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
                <button className="ml-1 px-3 h-7 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold shadow-[0_0_12px_oklch(0.623_0.214_259_/_0.5)]">
                  Follow
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Live badge */}
                <span className="flex items-center gap-1 px-2 h-7 rounded-xl bg-red-500 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </span>
                <span className="flex items-center gap-1 px-2 h-7 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white text-[11px] font-semibold tabular-nums">
                  <Eye className="h-3 w-3" />
                  {stream.viewer_count ?? 0}
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

            {/* Chat overlay */}
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

            {/* Like burst counter (right) */}
            <div className="absolute right-4 bottom-[112px] z-10 flex flex-col items-center gap-1 pointer-events-none">
              <Heart className="h-5 w-5 text-rose-400 fill-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]" />
              <span className="text-white text-[12px] font-bold tabular-nums drop-shadow">
                {likeCount}
              </span>
            </div>

            {/* Footer — Tip / input / heart / share */}
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
                  placeholder="Add comment…"
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
                onClick={() => {
                  // mimic a center heart tap
                  const id = heartIdRef.current++;
                  setHearts((h) => [
                    ...h,
                    { id, x: window.innerWidth / 2, y: window.innerHeight - 200 },
                  ]);
                  setLikeCount((c) => c + 1);
                  setTimeout(() => setHearts((h) => h.filter((p) => p.id !== id)), 1400);
                }}
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
          </>
        )}

        {/* Gift overlay */}
        <GiftAnimation
          gifts={activeGifts}
          onComplete={(id) => setActiveGifts((g) => g.filter((x) => x.id !== id))}
        />
      </div>

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
                      toast.success("Link copied");
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
                { label: "Report stream", onClick: () => toast("Reported"), destructive: true },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={cn(
                    "w-full text-left h-12 px-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-sm font-semibold transition-colors",
                    item.destructive ? "text-destructive" : "text-foreground"
                  )}
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
