"use client";

import { useState } from "react";
import Link from "next/link";
import { Music, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ClipCreator } from "@/components/clips/clip-creator";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { getSound, getClipsBySound } from "@/lib/queries/clips";
import { formatNumber } from "@/lib/utils/format";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { OrbitErrorState } from "@/components/orbit/error-state";
import type { PostWithAuthor } from "@/lib/queries/posts";

function ClipTile({ clip }: { clip: PostWithAuthor }) {
  const media = clip.post_media?.[0];
  return (
    <Link
      href={`/clips/${clip.id}`}
      className="group relative block aspect-[9/16] overflow-hidden rounded-lg border border-border bg-surface"
    >
      {media?.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.thumbnail_url}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : media?.url ? (
        // No stored cover frame (the web creator uploads none); the video's
        // own first frame stands in via preload="metadata".
        <video
          src={media.url}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <Music className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5">
        <Play className="h-3 w-3 fill-white text-white" />
        <span className="text-[11px] font-semibold tabular-nums text-white">
          {formatNumber(clip.view_count ?? 0)}
        </span>
      </div>
    </Link>
  );
}

export function SoundContent({ soundId }: { soundId: string }) {
  const requireAuth = useRequireAuth();
  const [creatorOpen, setCreatorOpen] = useState(false);

  const { data: sound } = useQuery({
    queryKey: ["sound", soundId],
    queryFn: () => getSound(soundId),
  });

  const {
    data: clips,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["sound-clips", soundId],
    queryFn: () => getClipsBySound(soundId),
  });

  const useCount = sound?.use_count ?? 0;
  const title = sound
    ? sound.artist
      ? `${sound.name} · ${sound.artist}`
      : sound.name
    : "";

  const handleUseSound = () => {
    if (!requireAuth()) return;
    setCreatorOpen(true);
  };

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-8">
        <div className="pointer-events-none absolute inset-0 bg-primary/10" />
        <div className="relative">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            ◆&nbsp;&nbsp;SOUND · {formatNumber(useCount)} USE{useCount !== 1 ? "S" : ""}
          </p>
          <h1 className="mt-2.5 flex items-baseline gap-3 text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-foreground">
            <Music className="h-8 w-8 shrink-0 self-center text-primary" strokeWidth={2} />
            <span>
              {sound?.name ?? "Sound"}
              {sound?.artist && (
                <span className="text-primary"> · {sound.artist}</span>
              )}
            </span>
          </h1>
          <p className="mt-3 max-w-[520px] text-[14.5px] leading-[1.55] text-text-secondary">
            Every clip made with this sound. Your clip keeps its own audio,
            audio mixing comes later.
          </p>
          <div className="mt-[18px] flex gap-2.5">
            <Button size="lg" onClick={handleUseSound}>
              Use this sound
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[9/16] animate-pulse rounded-lg border border-border bg-surface"
            />
          ))}
        </div>
      ) : isError ? (
        <OrbitErrorState
          headline="Couldn't load this"
          accentWord="sound"
          sub={`Something went wrong fetching clips for ${title || "this sound"}.`}
          onRetry={() => refetch()}
        />
      ) : clips && clips.length > 0 ? (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {clips.map((clip) => (
            <ClipTile key={clip.id} clip={clip} />
          ))}
        </div>
      ) : (
        <OrbitEmptyState
          icon={Music}
          accent="var(--primary)"
          headline="Nothing"
          accentWord="on this sound"
          sub="No clips use this sound yet. Be the first."
        />
      )}

      <ClipCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        soundId={soundId}
        soundName={title || undefined}
      />
    </div>
  );
}
