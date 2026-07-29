import type { Metadata } from "next";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { EventContent } from "./event-content";

interface Props {
  params: Promise<{ eventId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("title, start_at, location, is_online, cover_url")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { title: { absolute: "Not found · Orbit" } };

  const when = format(new Date(event.start_at), "EEEE, MMMM d 'at' h:mm a");
  const where = event.is_online ? "Online" : event.location;
  const description = where
    ? `${when} · ${where}. RSVP on Orbit.`
    : `${when}. RSVP on Orbit.`;

  return {
    title: event.title,
    description,
    alternates: { canonical: `/events/${eventId}` },
    openGraph: {
      title: event.title,
      description,
      ...(event.cover_url ? { images: [event.cover_url] } : {}),
    },
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { eventId } = await params;
  return <EventContent eventId={eventId} />;
}
