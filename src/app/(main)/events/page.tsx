"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon, CalendarIcon, Sparkles } from "lucide-react";
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
      {/* Editorial hero */}
      <div className="px-6 pt-10 pb-6 max-w-6xl">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-2xl">
            <h1 className="hero-display">
              Things to <em>show up</em> for.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl">
              Meetups, launches, listening sessions — the real-world side of your network.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="rounded-full h-11 px-5 font-semibold text-sm btn-gradient shine relative overflow-hidden"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Create event
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="px-6 pb-20 max-w-6xl space-y-3">
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
        <div className="px-6 pb-20 max-w-6xl">
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
        <div className="px-6 pb-20 max-w-6xl space-y-3">
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
