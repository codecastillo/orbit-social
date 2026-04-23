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

const gradients = [
  "from-purple-600 via-pink-500 to-red-500",
  "from-blue-600 via-cyan-500 to-teal-500",
  "from-orange-500 via-red-500 to-pink-600",
  "from-green-500 via-emerald-500 to-cyan-500",
  "from-violet-600 via-purple-500 to-fuchsia-500",
  "from-rose-500 via-pink-500 to-purple-600",
];

function getGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

export function LiveStreamCard({ stream, className }: LiveStreamCardProps) {
  const gradient = getGradient(stream.id);

  return (
    <Link
      href={`/live/${stream.id}`}
      className={cn(
        "group block overflow-hidden rounded-xl ring-1 ring-foreground/10 transition-all hover:ring-foreground/20 hover:scale-[1.02]",
        className
      )}
    >
      {/* Thumbnail placeholder */}
      <div
        className={cn(
          "relative aspect-video bg-gradient-to-br",
          gradient
        )}
      >
        {/* LIVE badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Live
        </div>

        {/* Viewer count */}
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          <Eye className="h-3 w-3" />
          {formatNumber(stream.viewer_count)}
        </div>

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Stream info */}
      <div className="flex items-center gap-2.5 bg-card p-3">
        <UserAvatar
          src={stream.profiles.avatar_url}
          fallback={stream.profiles.display_name}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {stream.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {stream.profiles.display_name}
          </p>
        </div>
      </div>
    </Link>
  );
}
