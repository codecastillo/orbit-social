"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Play, MessageCircle, Eye, Radio, Send } from "lucide-react";
import { formatNumber } from "@/lib/utils/format";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getStreamById } from "@/lib/queries/live";
import { GiftPicker } from "@/components/live/gift-picker";
import { GiftAnimation } from "@/components/live/gift-animation";
import { sendGift, type GiftType, type SentGift } from "@/lib/queries/gifts";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

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

      // Get user profile info
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

export default function StreamViewerPage() {
  const params = useParams<{ streamId: string }>();
  const { user } = useAuth();
  const [activeGifts, setActiveGifts] = useState<SentGift[]>([]);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage } = useLiveChat(params.streamId);

  const handleSendGift = useCallback(
    (giftType: GiftType) => {
      const sentGift = sendGift(params.streamId, "viewer", giftType);
      setActiveGifts((prev) => [...prev, sentGift]);
    },
    [params.streamId]
  );

  const handleGiftComplete = useCallback((id: string) => {
    setActiveGifts((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    await sendMessage(chatInput);
    setChatInput("");
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { data: stream, isLoading } = useQuery({
    queryKey: ["live-stream", params.streamId],
    queryFn: () => getStreamById(params.streamId),
    enabled: !!params.streamId,
  });

  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <div className="mt-4 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Radio className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h2 className="text-lg font-medium">Stream not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This stream may have ended or doesn&apos;t exist.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 relative">
      {/* Gift animation overlay */}
      <GiftAnimation gifts={activeGifts} onComplete={handleGiftComplete} />

      {/* Video player placeholder */}
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black/90 ring-1 ring-foreground/10">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <Play className="h-8 w-8 text-white/70" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/80">
              Live streaming coming soon
            </p>
            <p className="mt-0.5 text-xs text-white/50">
              Video playback is not yet available
            </p>
          </div>
        </div>

        {/* Overlay badges */}
        {stream.status === "live" && (
          <div className="absolute top-3 left-3 flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Live
          </div>
        )}

        {stream.status === "ended" && (
          <div className="absolute top-3 left-3 rounded bg-zinc-700 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-zinc-300">
            Ended
          </div>
        )}

        <div className="absolute top-3 right-3 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
          <Eye className="h-3 w-3" />
          {formatNumber(stream.viewer_count)}
        </div>
      </div>

      {/* Stream info */}
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserAvatar
            src={stream.profiles.avatar_url}
            fallback={stream.profiles.display_name}
            size="md"
          />
          <div>
            <h1 className="text-base font-semibold">{stream.title}</h1>
            <p className="text-sm text-muted-foreground">
              {stream.profiles.display_name}
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              <span className="text-xs">@{stream.profiles.username}</span>
            </p>
          </div>
        </div>
        {stream.status === "live" && (
          <Badge className="bg-red-600 text-white">LIVE</Badge>
        )}
        {stream.status === "ended" && (
          <Badge variant="secondary">Ended</Badge>
        )}
      </div>

      {/* Gift picker -- visible when stream is live */}
      {stream.status === "live" && (
        <div className="mt-4 flex justify-end">
          <GiftPicker onSendGift={handleSendGift} />
        </div>
      )}

      {/* Live Chat */}
      <div className="mt-6 flex flex-col rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
        {/* Chat header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Live Chat</span>
          {stream.status === "live" && (
            <span className="relative flex h-2 w-2 ml-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
          )}
        </div>

        {/* Chat messages area */}
        <div className="h-[280px] overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground/60">
                {stream.status === "live"
                  ? "No messages yet. Be the first to chat!"
                  : "Chat is only available during live streams."}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2">
                <div className="shrink-0 mt-0.5">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-[10px] font-bold text-white/70">
                    {msg.displayName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-blue-400 mr-1.5">
                    {msg.displayName}
                  </span>
                  <span className="text-sm text-zinc-300 break-words">
                    {msg.content}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat input */}
        {stream.status === "live" && user ? (
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="Send a message..."
                className="flex-1 h-9 px-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40 transition-colors"
              />
              <Button
                size="icon"
                className="h-9 w-9 rounded-lg bg-blue-500 hover:bg-blue-600 text-white border-0 shrink-0"
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : stream.status === "ended" ? (
          <div className="px-4 py-3 border-t border-white/[0.06] text-center">
            <p className="text-xs text-muted-foreground">
              This stream has ended. Chat is no longer available.
            </p>
          </div>
        ) : (
          <div className="px-4 py-3 border-t border-white/[0.06] text-center">
            <p className="text-xs text-muted-foreground">
              Sign in to chat
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
