"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { LiveStreamWithProfile } from "@/lib/queries/live";

interface LiveStreamCardProps {
  stream: LiveStreamWithProfile;
  className?: string;
}

const TILES = ["tile-pink", "tile-blue", "tile-green", "tile-amber", "tile-violet", "tile-sunset"];

function tileFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TILES[Math.abs(hash) % TILES.length];
}

export function LiveStreamCard({ stream, className }: LiveStreamCardProps) {
  const tile = tileFor(stream.id);

  return (
    <Link
      href={`/live/${stream.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl aspect-[4/5] hover-lift",
        tile,
        className
      )}
    >
      {/* Darkening scrim for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/70" />

      {/* Top chrome: LIVE + viewers */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 h-5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          Live
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 px-2 h-5 text-[10px] font-semibold text-white tabular-nums">
          <Eye className="h-2.5 w-2.5" />
          {formatNumber(stream.viewer_count)}
        </div>
      </div>

      {/* Title + author bottom */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-white text-[15px] font-bold leading-snug line-clamp-2 mb-3 drop-shadow">
          {stream.title}
        </p>
        <div className="flex items-center gap-2">
          <UserAvatar
            src={stream.profiles.avatar_url}
            fallback={stream.profiles.display_name}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold text-white leading-tight">
              {stream.profiles.display_name}
            </p>
            <p className="truncate text-[11px] text-white/70 leading-tight">
              @{stream.profiles.username}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
