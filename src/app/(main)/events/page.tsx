"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Calendar as CalIcon,
  Share2,
  CheckCircle2,
  Star,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CreateEventDialog } from "@/components/events/create-event-dialog";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import {
  getEvents,
  rsvpEvent,
  removeRsvp,
  getUserRsvpStatuses,
  type EventWithCreator,
} from "@/lib/queries/events";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { createClient } from "@/lib/supabase/client";

type RsvpStatus = "going" | "interested" | "not_going" | null;

function formatDay(iso: string): { day: string; mo: string; weekday: string; time: string } {
  const d = new Date(iso);
  return {
    day: d.getDate().toString().padStart(2, "0"),
    mo: d
      .toLocaleDateString(undefined, { month: "short" })
      .toUpperCase(),
    weekday: d
      .toLocaleDateString(undefined, { weekday: "short" })
      .toUpperCase(),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

export default function EventsPage() {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [rsvpMap, setRsvpMap] = useState<Record<string, RsvpStatus>>({});

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEvents();
      setEvents(data);
      if (user && data.length) {
        // Single round-trip instead of N (one per event).
        const map = await getUserRsvpStatuses(
          data.map((e) => e.id),
          user.id,
        );
        setRsvpMap(map);
      }
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Realtime: keep attendee_count in sync across the feed.
  useEffect(() => {
    const channel = supabase
      .channel(`events-feed-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events" },
        (payload) => {
          const updated = payload.new as Partial<EventWithCreator> & { id: string };
          setEvents((prev) =>
            prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleRsvp = useCallback(
    async (eventId: string, status: "going" | "interested" | "not_going") => {
      if (!requireAuth() || !user) return;
      const prev = rsvpMap[eventId] ?? null;
      const isToggleOff = prev === status;
      const next: RsvpStatus = isToggleOff ? null : status;

      const wasGoing = prev === "going";
      const willBeGoing = next === "going";
      const delta = wasGoing === willBeGoing ? 0 : willBeGoing ? 1 : -1;

      // Optimistic
      setRsvpMap((m) => ({ ...m, [eventId]: next }));
      if (delta !== 0) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? {
                  ...e,
                  attendee_count: Math.max(0, (e.attendee_count ?? 0) + delta),
                }
              : e
          )
        );
      }

      try {
        if (isToggleOff) {
          await removeRsvp(eventId, user.id);
        } else {
          await rsvpEvent(eventId, user.id, status);
        }
      } catch (err) {
        console.error("Failed to RSVP:", err);
        toast.error("Couldn't update RSVP");
        // Rollback
        setRsvpMap((m) => ({ ...m, [eventId]: prev }));
        if (delta !== 0) {
          setEvents((prevEvts) =>
            prevEvts.map((e) =>
              e.id === eventId
                ? {
                    ...e,
                    attendee_count: Math.max(0, (e.attendee_count ?? 0) - delta),
                  }
                : e
            )
          );
        }
      }
    },
    [user, rsvpMap, requireAuth]
  );

  return (
    <div className="flex flex-col gap-[22px] text-foreground">
      {/* Editorial hero */}
      <div className="flex flex-wrap items-end justify-between gap-[18px]">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            ◇&nbsp;&nbsp;EVENTS
          </p>
          <h1 className="mt-2 text-[56px] font-bold leading-none tracking-[-0.035em]">
            Things to <span className="text-primary">show up</span> for.
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Meetups, launches, listening sessions. The real-world side of your network.
          </p>
        </div>
        {user && (
          <Button size="lg" onClick={() => setShowCreate(true)}>
            Host
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      ) : events.length === 0 ? (
        <OrbitEmptyState
          icon={CalIcon}
          accent="var(--primary)"
          headline="Nothing"
          accentWord="scheduled"
          sub="No events on your orbit yet. Create a meetup, a listening session, a launch. The real-world side of this place."
        />
      ) : (
        <>
          <FeaturedEvent
            event={events[0]}
            rsvpStatus={rsvpMap[events[0].id] ?? null}
            onRsvp={handleRsvp}
          />
          {events.length > 1 && (
            <EverythingElse
              events={events.slice(1)}
              rsvpMap={rsvpMap}
              onRsvp={handleRsvp}
            />
          )}
        </>
      )}

      <CreateEventDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={fetchEvents}
      />
    </div>
  );
}

/* ─── Featured event hero ────────────────────────────────────────── */

function FeaturedEvent({
  event,
  rsvpStatus,
  onRsvp,
}: {
  event: EventWithCreator;
  rsvpStatus: RsvpStatus;
  onRsvp: (eventId: string, status: "going" | "interested" | "not_going") => void;
}) {
  const dayInfo = formatDay(event.start_at);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      href={`/events/${event.id}`}
      className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-surface text-foreground no-underline md:max-h-[420px] md:grid-cols-2"
    >
      {/* Cover, fixed height so it never grows on wide screens */}
      <div className="relative flex h-[420px] max-h-[420px] items-center justify-center bg-primary/10">
        <CalIcon className="h-16 w-16 text-primary/30" strokeWidth={1} />
        <div className="absolute left-[22px] top-[22px] min-w-[70px] rounded-xl border border-border bg-surface p-4 text-center">
          <div className="font-mono text-[11px] font-bold tracking-[0.1em] text-primary">
            {dayInfo.mo}
          </div>
          <div className="mt-0.5 text-[42px] font-bold leading-none text-foreground">
            {dayInfo.day}
          </div>
          <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
            {dayInfo.weekday} · {dayInfo.time}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-hidden p-8">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary">
          ◆&nbsp;&nbsp;FEATURED · {event.attendee_count ?? 0} GOING
        </p>
        <h2 className="mt-3 text-4xl font-bold leading-tight tracking-[-0.035em]">
          {event.title.split(" ").slice(0, 2).join(" ")}{" "}
          {event.title.split(" ").length > 2 && (
            <span className="text-primary">
              {event.title.split(" ").slice(2).join(" ")}
            </span>
          )}
        </h2>
        <div className="mt-2 font-mono text-[13px] tracking-[0.04em] text-muted-foreground">
          HOSTED BY {event.profiles.display_name.toUpperCase()}
          {event.location && ` · ${event.location.toUpperCase()}`}
        </div>
        {event.description && (
          <p className="mt-4 line-clamp-3 text-[14.5px] leading-[1.55] text-text-secondary">
            {event.description}
          </p>
        )}
        <div className="mt-[22px] flex min-w-0 flex-nowrap items-center gap-1.5">
          <Button
            variant={rsvpStatus === "going" ? "default" : "outline"}
            size="sm"
            onClick={(e) => {
              stop(e);
              onRsvp(event.id, "going");
            }}
          >
            <CheckCircle2 /> Going
          </Button>
          <Button
            variant={rsvpStatus === "interested" ? "default" : "outline"}
            size="sm"
            onClick={(e) => {
              stop(e);
              onRsvp(event.id, "interested");
            }}
          >
            <Star /> Interested
          </Button>
          <Button
            variant={rsvpStatus === "not_going" ? "default" : "outline"}
            size="sm"
            onClick={(e) => {
              stop(e);
              onRsvp(event.id, "not_going");
            }}
          >
            <XCircle /> Can&apos;t Go
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="ml-auto"
            onClick={(e) => {
              stop(e);
              if (typeof window !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(
                  `${window.location.origin}/events/${event.id}`
                );
                toast.success("Link copied");
              }
            }}
            aria-label="Share event"
          >
            <Share2 />
          </Button>
        </div>
      </div>
    </Link>
  );
}

/* ─── Everything else list ───────────────────────────────────────── */

function EverythingElse({
  events,
  rsvpMap,
  onRsvp,
}: {
  events: EventWithCreator[];
  rsvpMap: Record<string, RsvpStatus>;
  onRsvp: (eventId: string, status: "going" | "interested" | "not_going") => void;
}) {
  return (
    <div>
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        ◈&nbsp;&nbsp;EVERYTHING ELSE
      </p>
      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
        {events.map((e, i) => {
          const dayInfo = formatDay(e.start_at);
          const status = rsvpMap[e.id] ?? null;
          return (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className={`flex cursor-pointer items-center gap-[18px] px-[22px] py-[18px] text-foreground no-underline${i ? " border-t border-border" : ""}`}
            >
              <div className="w-14 shrink-0 rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-center">
                <div className="font-mono text-[9px] font-bold tracking-[0.1em] text-primary">
                  {dayInfo.mo}
                </div>
                <div className="mt-px text-2xl font-bold leading-none text-foreground">
                  {dayInfo.day}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{e.title}</div>
                <div className="mt-[3px] flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {e.location && <span>{e.location}</span>}
                  {e.is_online && !e.location && "Online"}
                  {(e.location || e.is_online) && (
                    <span className="text-text-faint">·</span>
                  )}
                  hosted by {e.profiles.display_name}
                </div>
              </div>
              <div className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                {e.attendee_count ?? 0} going
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant={status === "going" ? "default" : "outline"}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onRsvp(e.id, "going");
                  }}
                  title="Going"
                >
                  <CheckCircle2 /> Going
                </Button>
                <Button
                  size="icon-sm"
                  variant={status === "interested" ? "default" : "outline"}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onRsvp(e.id, "interested");
                  }}
                  title="Interested"
                  aria-label="Interested"
                >
                  <Star />
                </Button>
                <Button
                  size="icon-sm"
                  variant={status === "not_going" ? "default" : "outline"}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onRsvp(e.id, "not_going");
                  }}
                  title="Can't go"
                  aria-label="Can't go"
                >
                  <XCircle />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (typeof window !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/events/${e.id}`,
                      );
                      toast.success("Link copied");
                    }
                  }}
                  title="Share event"
                  aria-label="Share event"
                >
                  <Share2 />
                </Button>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
