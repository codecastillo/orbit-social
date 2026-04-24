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
      <div
        className="sticky top-0 z-10"
        style={{
          background: "oklch(0.14 0.02 270 / 0.7)",
          backdropFilter: "blur(40px) saturate(2)",
          WebkitBackdropFilter: "blur(40px) saturate(2)",
          borderBottom: "1px solid oklch(1 0 0 / 0.05)",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-red-500/25 to-rose-500/20 flex items-center justify-center border border-white/[0.06] relative">
              <Radio className="h-5 w-5 text-red-300" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-2xl font-extrabold tracking-tight"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}
                >
                  Live
                </h1>
                <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-red-500/15 border border-red-500/25">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">
                    On air
                  </span>
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5 font-medium">
                {streams?.length ?? 0} live now
              </p>
            </div>
          </div>

          <Button
            className="rounded-2xl h-10 px-4 font-semibold text-sm bg-red-500 hover:bg-red-600 text-white border-0 shadow-[0_4px_16px_rgba(239,68,68,0.4)]"
            onClick={() => setGoLiveOpen(true)}
          >
            <Radio className="h-4 w-4 mr-1.5" />
            Go Live
          </Button>
        </div>
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06]"
              >
                <Skeleton className="aspect-video w-full" />
                <div className="flex items-center gap-3 p-4">
                  <Skeleton className="h-10 w-10 rounded-2xl" />
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
