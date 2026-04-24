"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Play, MessageCircle, Eye, Radio } from "lucide-react";
import { formatNumber } from "@/lib/utils/format";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getStreamById } from "@/lib/queries/live";
import { GiftPicker } from "@/components/live/gift-picker";
import { GiftAnimation } from "@/components/live/gift-animation";
import { sendGift, type GiftType, type SentGift } from "@/lib/queries/gifts";

export default function StreamViewerPage() {
  const params = useParams<{ streamId: string }>();
  const [activeGifts, setActiveGifts] = useState<SentGift[]>([]);

  const handleSendGift = useCallback(
    (giftType: GiftType) => {
      // In a real app, userId would come from auth context
      const sentGift = sendGift(params.streamId, "viewer", giftType);
      setActiveGifts((prev) => [...prev, sentGift]);
    },
    [params.streamId]
  );

  const handleGiftComplete = useCallback((id: string) => {
    setActiveGifts((prev) => prev.filter((g) => g.id !== id));
  }, []);

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

      {/* Gift picker — visible when stream is live */}
      {stream.status === "live" && (
        <div className="mt-4 flex justify-end">
          <GiftPicker onSendGift={handleSendGift} />
        </div>
      )}

      {/* Chat placeholder */}
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl bg-card p-8 ring-1 ring-foreground/10">
        <MessageCircle className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          Live chat coming soon
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Chat with other viewers during live streams
        </p>
        <Button variant="outline" disabled className="mt-4">
          Send Message
        </Button>
      </div>
    </div>
  );
}
