"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Calendar as CalIcon, MapPin, Share2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateEventDialog } from "@/components/events/create-event-dialog";
import { OrbitEmptyState } from "@/components/orbit/empty-state";
import { getEvents, type EventWithCreator } from "@/lib/queries/events";
import { O, panel } from "@/lib/design/orbit";
import { Display, Acc, Eyebrow, PillBtn } from "@/components/orbit/primitives";

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
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEvents();
      setEvents(data);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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
          <Eyebrow>◇&nbsp;&nbsp;EVENTS · NEXT 4 WEEKS</Eyebrow>
          <Display size={56} style={{ marginTop: 8 }}>
            Things to <Acc>show up</Acc> for.
          </Display>
          <p style={{ fontSize: 14, color: O.ink2, marginTop: 8 }}>
            Meetups, launches, listening sessions — the real-world side of your network.
          </p>
        </div>
        <PillBtn primary size="lg" onClick={() => setShowCreate(true)}>
          <Plus style={{ width: 14, height: 14 }} strokeWidth={2.4} /> Host
        </PillBtn>
      </div>

      {loading ? (
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      ) : events.length === 0 ? (
        <OrbitEmptyState
          icon={CalIcon}
          accent={O.a3}
          headline="Nothing"
          accentWord="scheduled"
          sub="No events on your orbit yet. Create a meetup, a listening session, a launch — the real-world side of this place."
          ctaLabel="Create event"
          ctaIcon={<Plus style={{ width: 13, height: 13 }} />}
          onCta={() => setShowCreate(true)}
          secondaryLabel="Discover events"
        />
      ) : (
        <>
          <FeaturedEvent event={events[0]} />
          {events.length > 1 && <EverythingElse events={events.slice(1)} />}
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

function FeaturedEvent({ event }: { event: EventWithCreator }) {
  const dayInfo = formatDay(event.start_at);
  const hue = hueFor(event.id);
  const hue2 = (hue + 60) % 360;

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
      }}
      className="md:grid-cols-2 grid-cols-1"
    >
      {/* Cover */}
      <div
        style={{
          aspectRatio: "4/3",
          background: `linear-gradient(135deg, oklch(0.6 0.18 ${hue}), oklch(0.35 0.14 ${hue2}))`,
          position: "relative",
          minHeight: 280,
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
      <div style={{ padding: 32 }}>
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
            }}
          >
            {event.description}
          </p>
        )}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 22,
            flexWrap: "wrap",
          }}
        >
          <PillBtn primary size="lg">
            RSVP · I&apos;m in
          </PillBtn>
          <PillBtn size="lg">Maybe</PillBtn>
          <PillBtn size="lg" style={{ marginLeft: "auto" }}>
            <Share2 style={{ width: 14, height: 14 }} />
          </PillBtn>
        </div>
      </div>
    </Link>
  );
}

/* ─── Everything else list ───────────────────────────────────────── */

function EverythingElse({ events }: { events: EventWithCreator[] }) {
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
              <PillBtn size="sm">RSVP</PillBtn>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
