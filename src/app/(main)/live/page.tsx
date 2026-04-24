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
      {/* Editorial hero */}
      <div className="px-6 pt-10 pb-6 max-w-6xl">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-2xl">
            <h1 className="hero-display">
              Live and <em>unrehearsed</em>.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-red-500/15 border border-red-500/25">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">
                  On air
                </span>
              </span>
              <span className="tabular-nums">{streams?.length ?? 0} streams right now.</span>
            </p>
          </div>

          <Button
            className="rounded-full h-11 px-5 font-semibold text-sm bg-red-500 hover:bg-red-600 text-white border-0 shadow-[0_4px_16px_rgba(239,68,68,0.4)]"
            onClick={() => setGoLiveOpen(true)}
          >
            <Radio className="h-4 w-4 mr-1.5" />
            Go live
          </Button>
        </div>
      </div>

      <div className="px-6 pb-20 max-w-6xl">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
            ))}
          </div>
        ) : streams && streams.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {streams.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-white/[0.03] border border-white/[0.06] p-10">
            <EmptyState
              icon={Radio}
              title="No one is live right now"
              description="When people you follow go live, their streams will appear here."
            />
          </div>
        )}
      </div>

      <Dialog open={goLiveOpen} onOpenChange={setGoLiveOpen}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 bg-popover border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl">
          <DialogHeader className="p-5 border-b border-white/[0.06]">
            <DialogTitle className="flex items-center gap-2.5 text-foreground text-lg">
              <div className="h-9 w-9 rounded-2xl bg-red-500/15 flex items-center justify-center">
                <Radio className="h-4.5 w-4.5 text-red-400" />
              </div>
              Go Live
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Give your stream a title and start broadcasting.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">
                Stream Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you streaming?"
                maxLength={100}
                autoFocus
                className="w-full h-11 px-4 rounded-2xl text-sm bg-white/[0.04] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-red-500/50 focus:bg-white/[0.06] transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) handleGoLive();
                }}
              />
            </div>
          </div>

          <div className="p-5 border-t border-white/[0.06] flex justify-end">
            <Button
              onClick={handleGoLive}
              disabled={!title.trim() || creating}
              className="rounded-2xl h-11 px-6 font-semibold bg-red-500 hover:bg-red-600 text-white border-0 shadow-[0_4px_16px_rgba(239,68,68,0.4)] transition-all"
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
