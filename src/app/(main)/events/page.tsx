"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { EventCard } from "@/components/events/event-card";
import { CreateEventDialog } from "@/components/events/create-event-dialog";
import { getEvents, type EventWithCreator } from "@/lib/queries/events";

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
    <div className="min-h-screen">
      <div
        className="sticky top-0 z-10"
        style={{
          background: "oklch(0.14 0.02 270 / 0.7)",
          backdropFilter: "blur(40px) saturate(2)",
          WebkitBackdropFilter: "blur(40px) saturate(2)",
          borderBottom: "1px solid oklch(1 0 0 / 0.05)",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-500/20 flex items-center justify-center border border-white/[0.06]">
              <CalendarIcon className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <h1
                className="text-2xl font-extrabold tracking-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Events
              </h1>
              <p className="text-[12px] text-muted-foreground mt-0.5 font-medium">
                What's happening
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="rounded-2xl h-10 px-4 font-semibold text-sm bg-primary text-primary-foreground border-0 shadow-[0_4px_16px_oklch(0.623_0.214_259_/_0.4)] hover:brightness-110 transition-all"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Create
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-0 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06]"
            >
              <div className="w-20 shrink-0 bg-emerald-500/10 flex flex-col items-center justify-center p-3">
                <Skeleton className="h-4 w-8 mb-1" />
                <Skeleton className="h-7 w-7" />
              </div>
              <div className="flex-1 p-4 space-y-2.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="p-5">
          <div className="rounded-3xl bg-white/[0.03] border border-white/[0.06] p-10">
            <EmptyState
              icon={CalendarIcon}
              title="No upcoming events"
              description="Create an event or check back later."
              action={
                <Button
                  onClick={() => setShowCreate(true)}
                  className="rounded-2xl h-10 px-5 font-semibold text-sm bg-primary text-primary-foreground border-0 shadow-[0_4px_16px_oklch(0.623_0.214_259_/_0.4)] hover:brightness-110"
                >
                  <PlusIcon className="h-4 w-4 mr-1.5" />
                  Create Event
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="p-5 space-y-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      <CreateEventDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={fetchEvents}
      />
    </div>
  );
}
