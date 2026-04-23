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
    <div className="border-x border-border min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold">Events</h1>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <PlusIcon className="h-4 w-4" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Event list */}
      {loading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-xl p-3 border border-white/5"
            >
              <Skeleton className="h-24 w-24 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="No upcoming events"
          description="Create an event or check back later."
          action={
            <Button onClick={() => setShowCreate(true)} size="sm">
              <PlusIcon className="h-4 w-4" />
              Create Event
            </Button>
          }
        />
      ) : (
        <div className="p-4 space-y-3">
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
