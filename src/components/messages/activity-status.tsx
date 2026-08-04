"use client";

import { cn } from "@/lib/utils";
import type { Presence } from "@/lib/queries/presence";

/**
 * Activity status for a DM counterpart: a green dot while they are online,
 * "Active 5m ago" once they are not. Renders nothing when presence is null,
 * which covers both a hidden counterpart and a viewer who hides their own.
 */
export function ActivityStatus({
  presence,
  className,
}: {
  presence: Presence | null;
  className?: string;
}) {
  if (!presence) return null;

  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[12px] text-muted-foreground",
        className
      )}
    >
      {presence.online && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
        />
      )}
      {presence.label}
    </span>
  );
}

/** Dot-only variant for avatar corners in dense list rows. */
export function ActivityDot({ presence }: { presence: Presence | null }) {
  if (!presence?.online) return null;

  return (
    <span
      aria-label="Active now"
      role="img"
      className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-success"
    />
  );
}
