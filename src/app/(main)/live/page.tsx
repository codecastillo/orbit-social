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
      <div className="sticky top-0 z-10 bg-background/70 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center relative">
              <Radio className="h-4.5 w-4.5 text-red-400" />
              <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Live</h1>
          </div>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  disabled
                  size="sm"
                  className="rounded-full px-4 h-9 font-medium border-white/[0.12] bg-white/[0.04]"
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
      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.05]"
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
          <EmptyState
            icon={Radio}
            title="No one is live right now"
            description="When people you follow go live, their streams will appear here."
          />
        )}
      </div>
    </div>
  );
}
