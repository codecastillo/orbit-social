"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Calendar as CalIcon,
  MapPin,
  Share2,
  CheckCircle2,
  Star,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateEventDialog } from "@/components/events/create-event-dialog";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import {
  getEvents,
  rsvpEvent,
  removeRsvp,
  getUserRsvpStatus,
  type EventWithCreator,
} from "@/lib/queries/events";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { createClient } from "@/lib/supabase/client";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";

type RsvpStatus = "going" | "interested" | "not_going" | null;

function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }
  const hues = [18, 220, 290, 145, 50, 340, 180, 265];
  return hues[Math.abs(h) % hues.length];
}

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
        const entries = await Promise.all(
          data.map(async (e) => {
            const s = await getUserRsvpStatus(e.id, user.id);
            return [e.id, s] as const;
          })
        );
        setRsvpMap(Object.fromEntries(entries));
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
    <div
      style={{
        color: O.ink,
        fontFamily: O.sans,
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {/* Editorial hero */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Eyebrow>◇&nbsp;&nbsp;EVENTS</Eyebrow>
          <Display size={56} style={{ marginTop: 8 }}>
            Things to <Acc>show up</Acc> for.
          </Display>
          <p style={{ fontSize: 14, color: O.ink2, marginTop: 8 }}>
            Meetups, launches, listening sessions. The real-world side of your network.
          </p>
        </div>
        {user && (
          <PillBtn primary size="lg" onClick={() => setShowCreate(true)}>
            Host
          </PillBtn>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      ) : events.length === 0 ? (
        <OrbitEmptyState
          icon={CalIcon}
          accent={O.a3}
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
  const hue = hueFor(event.id);
  const hue2 = (hue + 60) % 360;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      href={`/events/${event.id}`}
      style={{
        ...panel(),
        padding: 0,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        textDecoration: "none",
        color: O.ink,
        maxHeight: 420,
      }}
      className="md:grid-cols-2 grid-cols-1"
    >
      {/* Cover — fixed height so it never grows on wide screens */}
      <div
        style={{
          height: 420,
          maxHeight: 420,
          background: `linear-gradient(135deg, oklch(0.6 0.18 ${hue}), oklch(0.35 0.14 ${hue2}))`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.25), transparent 60%), repeating-linear-gradient(45deg, transparent 0 28px, rgba(255,255,255,0.05) 28px 29px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 22,
            padding: 16,
            borderRadius: 16,
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(20px)",
            textAlign: "center",
            minWidth: 70,
            color: "white",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              fontFamily: O.mono,
            }}
          >
            {dayInfo.mo}
          </div>
          <div
            style={{
              fontFamily: O.serif,
              fontStyle: "italic",
              fontSize: 42,
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            {dayInfo.day}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: "rgba(255,255,255,0.8)",
              marginTop: 2,
              fontFamily: O.mono,
            }}
          >
            {dayInfo.weekday} · {dayInfo.time}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 32, overflow: "hidden" }}>
        <Eyebrow accent>
          ◆&nbsp;&nbsp;FEATURED · {event.attendee_count ?? 0} GOING
        </Eyebrow>
        <Display size={36} style={{ marginTop: 12 }}>
          {event.title.split(" ").slice(0, 2).join(" ")}{" "}
          {event.title.split(" ").length > 2 && (
            <Acc>{event.title.split(" ").slice(2).join(" ")}</Acc>
          )}
        </Display>
        <div
          style={{
            fontSize: 13,
            color: O.ink3,
            marginTop: 8,
            fontFamily: O.mono,
            letterSpacing: "0.04em",
          }}
        >
          HOSTED BY @{event.profiles.username.toUpperCase()}
          {event.location && ` · ${event.location.toUpperCase()}`}
        </div>
        {event.description && (
          <p
            style={{
              fontSize: 14.5,
              color: O.ink2,
              lineHeight: 1.55,
              marginTop: 16,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {event.description}
          </p>
        )}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 22,
            flexWrap: "nowrap",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          <PillBtn
            primary={rsvpStatus === "going"}
            size="md"
            onClick={(e) => {
              stop(e);
              onRsvp(event.id, "going");
            }}
            style={{ whiteSpace: "nowrap" }}
          >
            <CheckCircle2 style={{ width: 13, height: 13 }} /> Going
          </PillBtn>
          <PillBtn
            primary={rsvpStatus === "interested"}
            size="md"
            onClick={(e) => {
              stop(e);
              onRsvp(event.id, "interested");
            }}
            style={{ whiteSpace: "nowrap" }}
          >
            <Star style={{ width: 13, height: 13 }} /> Interested
          </PillBtn>
          <PillBtn
            primary={rsvpStatus === "not_going"}
            size="md"
            onClick={(e) => {
              stop(e);
              onRsvp(event.id, "not_going");
            }}
            style={{ whiteSpace: "nowrap" }}
          >
            <XCircle style={{ width: 13, height: 13 }} /> Can&apos;t Go
          </PillBtn>
          <PillBtn
            size="md"
            style={{ marginLeft: "auto", padding: "10px 12px" }}
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
            <Share2 style={{ width: 14, height: 14 }} />
          </PillBtn>
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
      <Eyebrow>◈&nbsp;&nbsp;EVERYTHING ELSE</Eyebrow>
      <div
        style={{
          ...panel(),
          padding: 0,
          marginTop: 12,
          overflow: "hidden",
        }}
      >
        {events.map((e, i) => {
          const dayInfo = formatDay(e.start_at);
          const hue = hueFor(e.id);
          const hue2 = (hue + 60) % 360;
          const status = rsvpMap[e.id] ?? null;
          return (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              style={{
                display: "flex",
                gap: 18,
                padding: "18px 22px",
                borderTop: i ? `1px solid ${O.hair}` : "none",
                alignItems: "center",
                cursor: "pointer",
                color: O.ink,
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: 56,
                  padding: 10,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, oklch(0.6 0.16 ${hue}), oklch(0.4 0.12 ${hue2}))`,
                  textAlign: "center",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
                  flexShrink: 0,
                  color: "white",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    fontFamily: O.mono,
                  }}
                >
                  {dayInfo.mo}
                </div>
                <div
                  style={{
                    fontFamily: O.serif,
                    fontStyle: "italic",
                    fontSize: 24,
                    lineHeight: 1,
                    marginTop: 1,
                  }}
                >
                  {dayInfo.day}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{e.title}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: O.ink3,
                    marginTop: 3,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {e.location && (
                    <>
                      <MapPin style={{ width: 11, height: 11 }} strokeWidth={1.8} />
                      {e.location}
                    </>
                  )}
                  {e.is_online && !e.location && "Online"}
                  <span style={{ color: O.ink4 }}>·</span>
                  hosted by {e.profiles.display_name.split(" ")[0]}
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: O.ink3,
                  fontFamily: O.mono,
                  whiteSpace: "nowrap",
                }}
              >
                {e.attendee_count ?? 0} going
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <PillBtn
                  size="sm"
                  primary={status === "going"}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onRsvp(e.id, "going");
                  }}
                  title="Going"
                >
                  <CheckCircle2 style={{ width: 11, height: 11 }} /> Going
                </PillBtn>
                <PillBtn
                  size="sm"
                  primary={status === "interested"}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onRsvp(e.id, "interested");
                  }}
                  title="Interested"
                  aria-label="Interested"
                >
                  <Star style={{ width: 11, height: 11 }} />
                </PillBtn>
                <PillBtn
                  size="sm"
                  primary={status === "not_going"}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onRsvp(e.id, "not_going");
                  }}
                  title="Can't go"
                  aria-label="Can't go"
                >
                  <XCircle style={{ width: 11, height: 11 }} />
                </PillBtn>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
