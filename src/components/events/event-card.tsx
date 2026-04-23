"use client";

import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { MapPinIcon, UsersIcon, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import type { EventWithCreator } from "@/lib/queries/events";

interface EventCardProps {
  event: EventWithCreator;
  className?: string;
}

export function EventCard({ event, className }: EventCardProps) {
  const startDate = new Date(event.start_at);

  return (
    <Link
      href={`/events/${event.id}`}
      className={cn(
        "group flex gap-4 rounded-xl p-3 border border-white/5 bg-white/[0.03] backdrop-blur-sm transition-all hover:bg-white/[0.06] hover:border-white/10",
        className
      )}
    >
      {/* Cover image / date block */}
      <div className="relative h-24 w-24 shrink-0 rounded-lg overflow-hidden bg-muted/30">
        {event.cover_url ? (
          <Image
            src={event.cover_url}
            alt={event.title}
            fill
            className="object-cover"
            sizes="96px"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/30 to-purple-600/30 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">
              {format(startDate, "d")}
            </span>
            <span className="text-xs font-medium uppercase text-muted-foreground">
              {format(startDate, "MMM")}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
          <CalendarIcon className="h-3 w-3" />
          <span>{format(startDate, "MMM d, h:mm a")}</span>
        </div>

        <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
          {event.title}
        </h3>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {event.location && (
            <div className="flex items-center gap-1 truncate">
              <MapPinIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <UsersIcon className="h-3 w-3" />
            <span>{formatNumber(event.attendee_count)} attending</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
