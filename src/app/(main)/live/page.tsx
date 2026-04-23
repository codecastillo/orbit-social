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
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-red-500" />
          <h1 className="text-xl font-bold">Live</h1>
        </div>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="outline" disabled>
                <Radio className="h-4 w-4" />
                Go Live
              </Button>
            }
          />
          <TooltipContent>Coming Soon</TooltipContent>
        </Tooltip>
      </div>

      {/* Stream grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl">
              <Skeleton className="aspect-video w-full" />
              <div className="flex items-center gap-2.5 p-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
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
  );
}
