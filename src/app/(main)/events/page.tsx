"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon, CalendarIcon, MapPinIcon, UsersIcon } from "lucide-react";
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
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/60 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <CalendarIcon className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Events</h1>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            size="sm"
            className="rounded-full py-2.5 px-5 h-auto font-medium bg-gradient-to-r from-violet-600 to-cyan-500 text-white border-0 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:brightness-110 transition-all"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Create
          </Button>
        </div>
      </div>

      {/* Event list */}
      {loading ? (
        <div className="p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-0 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl"
            >
              <div className="w-20 shrink-0 bg-violet-500/10 flex flex-col items-center justify-center p-3">
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
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl p-10">
            <EmptyState
              icon={CalendarIcon}
              title="No upcoming events"
              description="Create an event or check back later."
              action={
                <Button
                  onClick={() => setShowCreate(true)}
                  size="sm"
                  className="rounded-full px-5 bg-gradient-to-r from-violet-600 to-cyan-500 text-white border-0 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:brightness-110 transition-all"
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
