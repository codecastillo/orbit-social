"use client";

import { use, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Share2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getVodById, incrementVodViews, deleteVod } from "@/lib/queries/vods";
import { useAuth } from "@/lib/hooks/use-auth";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedStar } from "@/components/orbit/verified-star";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MuxPlayer = dynamic(
  () => import("@mux/mux-player-react").then((m) => m.default),
  { ssr: false },
);

interface Props {
  params: Promise<{ vodId: string }>;
}

interface StreamerProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
}

const PLAYER_STYLE = {
  "--media-object-fit": "contain",
  width: "100%",
  height: "100%",
} as React.CSSProperties & Record<string, string>;

function fmtNumber(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${n}`;
}

function postedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function VodPage({ params }: Props) {
  const { vodId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const incrementedRef = useRef(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: vod, isLoading } = useQuery({
    queryKey: ["vod", vodId],
    queryFn: () => getVodById(vodId),
  });

  const { data: streamer } = useQuery<StreamerProfile | null>({
    queryKey: ["vod-streamer", vod?.user_id],
    enabled: !!vod?.user_id,
    queryFn: async () => {
      if (!vod?.user_id) return null;
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_verified")
        .eq("id", vod.user_id)
        .single();
      return (data as StreamerProfile | null) ?? null;
    },
  });

  useEffect(() => {
    if (!vod || incrementedRef.current) return;
    incrementedRef.current = true;
    incrementVodViews(vod.id).catch(() => {
      incrementedRef.current = false;
    });
  }, [vod]);

  // Patch the saved duration with whatever the player reports once metadata
  // loads. Mux's webhook records the duration of the *individual asset*,
  // which can be a short tail segment after a reconnect; the actual
  // playable length is what the user sees. We trust the player, write back
  // to the row, and invalidate the profile/feed caches so the VOD card
  // shows the right number without a hard refresh.
  const handleLoadedMetadata = (e: Event) => {
    const target = e.target as HTMLVideoElement | null;
    if (!target || !vod) return;
    const playable = Math.round(target.duration);
    if (!Number.isFinite(playable) || playable <= 0) return;
    if (playable === vod.duration_seconds) return;
    void createClient()
      .from("live_vods")
      .update({ duration_seconds: playable })
      .eq("id", vod.id)
      .then(({ error }) => {
        if (error) {
          console.error("VOD duration self-heal failed", error);
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["vod", vod.id] });
        queryClient.invalidateQueries({ queryKey: ["user-vods", vod.user_id] });
      });
  };

  const isOwner = !!user && !!vod && user.id === vod.user_id;

  const handleConfirmDelete = async () => {
    if (!vod) return;
    setDeleting(true);
    try {
      await deleteVod(vod.id);
      toast.success("VOD deleted");
      queryClient.invalidateQueries({ queryKey: ["user-vods", vod.user_id] });
      setConfirmDeleteOpen(false);
      router.back();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete VOD");
    } finally {
      setDeleting(false);
    }
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (!vod) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-3 text-white/70">
        <p className="text-lg font-semibold">VOD not found</p>
        <button
          onClick={() => router.back()}
          className="text-sm underline underline-offset-4"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 h-9 px-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 text-white text-[12.5px] font-semibold hover:bg-black/60 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <div className="mx-auto w-full max-w-[1280px] px-4 pt-16 pb-16">
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/[0.08] bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
          <MuxPlayer
            playbackId={vod.mux_playback_id}
            autoPlay={false}
            style={PLAYER_STYLE}
            metadata={{
              video_id: vod.id,
              video_title: vod.title ?? undefined,
              viewer_user_id: user?.id ?? undefined,
            }}
            onLoadedMetadata={handleLoadedMetadata}
          />
        </div>

        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          {vod.title && (
            <h1 className="text-white text-[22px] font-bold leading-snug">
              {vod.title}
            </h1>
          )}
          <div className="flex items-center flex-wrap gap-2 mt-2 text-[12px] text-white/55 font-mono uppercase tracking-wider">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {fmtNumber(vod.view_count)} views
            </span>
            <span>·</span>
            <span>{postedAt(vod.created_at)}</span>
            {vod.category && (
              <>
                <span>·</span>
                <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/75 normal-case tracking-normal font-sans text-[11px] font-semibold">
                  {vod.category}
                </span>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            {streamer ? (
              <Link
                href={`/${streamer.username}`}
                className="flex items-center gap-3 min-w-0 flex-1 group rounded-xl -m-1 p-1 hover:bg-white/[0.03] transition-colors"
              >
                <UserAvatar
                  src={streamer.avatar_url}
                  fallback={streamer.display_name}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[15px] font-bold text-white leading-tight truncate group-hover:underline underline-offset-2">
                      {streamer.display_name}
                    </p>
                    {streamer.is_verified && <VerifiedStar size={13} />}
                  </div>
                  <p className="text-[12px] text-white/55 leading-tight truncate mt-0.5">
                    @{streamer.username}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex-1" />
            )}

            <button
              onClick={handleShare}
              className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-[12.5px] font-semibold hover:bg-white/[0.08] transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>

            {isOwner && (
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                aria-label="Delete VOD"
                className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-[12.5px] font-semibold hover:bg-red-500/25 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete this VOD?</DialogTitle>
            <DialogDescription>
              The recording will be removed from your profile and from Mux. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={deleting}
              className="h-9 px-4 rounded-full bg-white/[0.04] border border-white/10 text-white text-[13px] font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="h-9 px-5 rounded-full bg-red-500 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-70"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
