"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import {
  ArrowLeftIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  GlobeIcon,
  LinkIcon,
  UsersIcon,
  CheckCircle2Icon,
  StarIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatNumber } from "@/lib/utils/format";
import { useAuth } from "@/lib/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  getEventById,
  getEventAttendees,
  getUserRsvpStatus,
  rsvpEvent,
  removeRsvp,
  type EventWithCreator,
  type EventAttendee,
} from "@/lib/queries/events";

type RsvpStatus = "going" | "interested" | "not_going" | null;

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventWithCreator | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [eventData, attendeeData] = await Promise.all([
          getEventById(eventId),
          getEventAttendees(eventId, 10),
        ]);
        setEvent(eventData);
        setAttendees(attendeeData);

        if (user) {
          const status = await getUserRsvpStatus(eventId, user.id);
          setRsvpStatus(status);
        }
      } catch (err) {
        console.error("Failed to load event:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [eventId, user]);

  async function handleRsvp(status: "going" | "interested" | "not_going") {
    if (!user || !event) return;
    setRsvpLoading(true);
    try {
      if (rsvpStatus === status) {
        await removeRsvp(event.id, user.id);
        setRsvpStatus(null);
      } else {
        await rsvpEvent(event.id, user.id, status);
        setRsvpStatus(status);
      }
    } catch (err) {
      console.error("Failed to RSVP:", err);
    } finally {
      setRsvpLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="border-x border-border min-h-screen">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-6" />
        </div>
        <Skeleton className="aspect-[2/1] w-full" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="border-x border-border min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  const startDate = new Date(event.start_at);
  const endDate = event.end_at ? new Date(event.end_at) : null;

  return (
    <div className="border-x border-border min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b border-border bg-background/80 backdrop-blur-xl">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold truncate">Event</h1>
      </div>

      {/* Cover */}
      <div className="relative aspect-[2/1] bg-muted/20">
        {event.cover_url ? (
          <Image
            src={event.cover_url}
            alt={event.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 600px"
            priority
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-purple-600/20 to-pink-600/20 flex items-center justify-center">
            <CalendarIcon className="h-16 w-16 text-primary/40" />
          </div>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Date/time prominent display */}
        <div className="flex items-start gap-4">
          <div className="shrink-0 h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center">
            <span className="text-xs font-medium uppercase text-primary">
              {format(startDate, "MMM")}
            </span>
            <span className="text-lg font-bold text-foreground leading-tight">
              {format(startDate, "d")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{event.title}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <ClockIcon className="h-3.5 w-3.5" />
              <span>
                {format(startDate, "EEEE, MMMM d 'at' h:mm a")}
                {endDate && ` - ${format(endDate, "h:mm a")}`}
              </span>
            </div>
          </div>
        </div>

        {/* Location */}
        {(event.location || event.is_online) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {event.is_online ? (
              <>
                <GlobeIcon className="h-4 w-4 shrink-0" />
                <span>Online event</span>
                {event.online_url && (
                  <a
                    href={event.online_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline ml-1"
                  >
                    <LinkIcon className="h-3 w-3" />
                    Join link
                  </a>
                )}
              </>
            ) : (
              <>
                <MapPinIcon className="h-4 w-4 shrink-0" />
                <span>{event.location}</span>
              </>
            )}
          </div>
        )}

        {/* Attendees */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {attendees.slice(0, 5).map((attendee) => (
              <div key={attendee.user_id} className="ring-2 ring-background rounded-full">
                <UserAvatar
                  src={attendee.profiles.avatar_url}
                  fallback={
                    attendee.profiles.display_name ||
                    attendee.profiles.username
                  }
                  size="sm"
                />
              </div>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            <UsersIcon className="h-3.5 w-3.5 inline mr-1" />
            {formatNumber(event.attendee_count)} attending
          </span>
        </div>

        {/* RSVP buttons */}
        <div className="flex gap-2">
          <Button
            variant={rsvpStatus === "going" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => handleRsvp("going")}
            disabled={rsvpLoading}
          >
            <CheckCircle2Icon className="h-4 w-4" />
            Going
          </Button>
          <Button
            variant={rsvpStatus === "interested" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => handleRsvp("interested")}
            disabled={rsvpLoading}
          >
            <StarIcon className="h-4 w-4" />
            Interested
          </Button>
          <Button
            variant={rsvpStatus === "not_going" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => handleRsvp("not_going")}
            disabled={rsvpLoading}
          >
            <XCircleIcon className="h-4 w-4" />
            Can't Go
          </Button>
        </div>

        {/* Description */}
        {event.description && (
          <div className="pt-4 border-t border-white/5">
            <h3 className="text-sm font-medium mb-2">About</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        )}

        {/* Creator */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          <UserAvatar
            src={event.profiles.avatar_url}
            fallback={event.profiles.display_name || event.profiles.username}
            size="md"
          />
          <div>
            <p className="text-xs text-muted-foreground">Hosted by</p>
            <p className="font-medium text-sm">
              {event.profiles.display_name || event.profiles.username}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
