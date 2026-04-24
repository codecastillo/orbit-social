"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Radio, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveStreamCard } from "@/components/live/live-stream-card";
import { getLiveStreams, createStream } from "@/lib/queries/live";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function LivePage() {
  const { data: streams, isLoading } = useQuery({
    queryKey: ["live-streams"],
    queryFn: getLiveStreams,
    refetchInterval: 15000,
  });

  const { user } = useAuth();
  const router = useRouter();
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const handleGoLive = async () => {
    if (!user) {
      toast.error("You must be signed in to go live");
      return;
    }
    if (!title.trim()) return;

    setCreating(true);
    try {
      const stream = await createStream(user.id, title.trim());
      setGoLiveOpen(false);
      setTitle("");
      router.push(`/live/${stream.id}`);
    } catch {
      toast.error("Failed to create stream");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-background/80 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center relative">
              <Radio className="h-4.5 w-4.5 text-red-400" />
              <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">Live</h1>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="rounded-xl h-10 px-5 font-semibold text-sm cursor-pointer border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            onClick={() => setGoLiveOpen(true)}
          >
            <Radio className="h-4 w-4 mr-1.5" />
            Go Live
          </Button>
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

      {/* Go Live Dialog */}
      <Dialog open={goLiveOpen} onOpenChange={setGoLiveOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 gap-0 bg-zinc-900 border-white/[0.1] rounded-xl overflow-hidden shadow-2xl">
          <DialogHeader className="p-4 border-b border-white/[0.06]">
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              <Radio className="h-4.5 w-4.5 text-red-400" />
              Go Live
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">
              Give your stream a title and start broadcasting.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">
                Stream Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you streaming?"
                maxLength={100}
                autoFocus
                className="w-full h-10 px-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.1] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) handleGoLive();
                }}
              />
            </div>
          </div>

          <div className="p-4 border-t border-white/[0.06] flex justify-end">
            <Button
              onClick={handleGoLive}
              disabled={!title.trim() || creating}
              className="rounded-lg px-6 font-semibold bg-red-500 hover:bg-red-600 text-white border-0 transition-colors"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Radio className="h-4 w-4 mr-2" />
              )}
              Start Stream
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
