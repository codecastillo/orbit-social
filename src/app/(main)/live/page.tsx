"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { LiveStreamCard } from "@/components/live/live-stream-card";
import { getLiveStreams, createStream } from "@/lib/queries/live";
import { useAuth } from "@/lib/hooks/use-auth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalShell, Field, Input } from "@/components/orbit/forms";
import { O } from "@/lib/design/orbit";

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
          <OrbitEmptyState
            icon={Radio}
            accent="#ff5a6a"
            headline="Nobody's"
            accentWord="on air"
            sub="When people you follow go live, you'll find their streams here. Or skip the wait and go first."
            ctaLabel="Go live"
            ctaIcon={<Radio style={{ width: 12, height: 12 }} />}
            onCta={() => setGoLiveOpen(true)}
            secondaryLabel="Notify me"
          />
        )}
      </div>

      <Dialog open={goLiveOpen} onOpenChange={setGoLiveOpen}>
        <DialogContent
          className="p-0 gap-0 border-0 bg-transparent shadow-none max-w-none w-auto"
          style={{ boxShadow: "none" }}
        >
          <ModalShell
            title="Go live"
            subtitle="Hit start and you're broadcasting. No rehearsal."
            icon={<Radio style={{ width: 18, height: 18 }} />}
            accent="#ff5a6a"
            primaryLabel={creating ? "Starting…" : "Start stream"}
            secondaryLabel="Cancel"
            canSubmit={!!title.trim()}
            loading={creating}
            onPrimary={handleGoLive}
            onSecondary={() => setGoLiveOpen(false)}
            onClose={() => setGoLiveOpen(false)}
          >
            <Field label="Stream title">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you streaming?"
                maxLength={100}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) handleGoLive();
                }}
              />
            </Field>
            <Field label="Preview">
              <div
                style={{
                  aspectRatio: "16/9",
                  borderRadius: 14,
                  position: "relative",
                  overflow: "hidden",
                  background:
                    "linear-gradient(135deg, oklch(0.25 0.04 260), oklch(0.15 0.05 280))",
                  border: `1px solid ${O.hair2}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 10px, transparent 10px 20px)",
                  }}
                />
                <div style={{ textAlign: "center", color: O.ink3 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "rgba(255,90,106,0.15)",
                      border: "1px solid rgba(255,90,106,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 10px",
                    }}
                  >
                    <Radio style={{ width: 20, height: 20, color: "#ff5a6a" }} />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: O.ink2,
                      fontFamily: O.mono,
                      letterSpacing: "0.06em",
                    }}
                  >
                    READY TO STREAM
                  </div>
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    padding: "4px 9px",
                    borderRadius: 99,
                    background: "rgba(255,90,106,0.2)",
                    border: "1px solid rgba(255,90,106,0.5)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#ff5a6a",
                    fontFamily: O.mono,
                    letterSpacing: "0.1em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#ff5a6a",
                      boxShadow: "0 0 8px #ff5a6a",
                    }}
                  />
                  READY
                </div>
              </div>
            </Field>
          </ModalShell>
        </DialogContent>
      </Dialog>
    </div>
  );
}
