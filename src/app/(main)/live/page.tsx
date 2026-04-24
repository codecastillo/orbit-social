"use client";

import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveStreamCard } from "@/components/live/live-stream-card";
import { getLiveStreams } from "@/lib/queries/live";

export default function LivePage() {
  const { data: streams, isLoading } = useQuery({
    queryKey: ["live-streams"],
    queryFn: getLiveStreams,
    refetchInterval: 15000,
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center relative">
              <Radio className="h-4.5 w-4.5 text-red-400" />
              <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Live</h1>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
              </span>
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  disabled
                  size="sm"
                  className="rounded-full px-5 h-9 font-medium border-white/[0.08] bg-white/[0.04] text-zinc-400"
                >
                  <Radio className="h-4 w-4 mr-1.5" />
                  Go Live
                </Button>
              }
            />
            <TooltipContent>Coming Soon</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Stream grid */}
      <div className="p-5">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl"
              >
                <Skeleton className="aspect-video w-full" />
                <div className="flex items-center gap-3 p-4">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : streams && streams.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {streams.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl p-10">
            <EmptyState
              icon={Radio}
              title="No one is live right now"
              description="When people you follow go live, their streams will appear here."
            />
          </div>
        )}
      </div>
    </div>
  );
}
