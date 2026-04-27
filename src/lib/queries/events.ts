import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface EventWithCreator {
  id: string;
  creator_id: string;
  community_id: string | null;
  title: string;
  description: string | null;
  cover_url: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  is_online: boolean;
  online_url: string | null;
  attendee_count: number;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

export interface EventAttendee {
  event_id: string;
  user_id: string;
  status: "going" | "interested" | "not_going";
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

const EVENT_SELECT = `
  *,
  profiles!events_creator_id_fkey (
    id, username, display_name, avatar_url, is_verified
  )
`;

export async function getEvents(cursor?: string, limit = 20) {
  // Show events whose start is today or later (local-day floor), so an event
  // created for "today 1pm" still appears even if the user creates it at 2pm.
  const todayFloor = new Date();
  todayFloor.setHours(0, 0, 0, 0);

  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_at", todayFloor.toISOString())
    .order("start_at", { ascending: true })
    .limit(limit);

  if (cursor) {
    query = query.gt("start_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as EventWithCreator[];
}

export async function getEventById(eventId: string) {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", eventId)
    .single();

  if (error) throw error;
  return data as unknown as EventWithCreator;
}

export async function createEvent(
  creatorId: string,
  data: {
    title: string;
    description?: string;
    location?: string;
    start_at: string;
    end_at?: string;
    is_online?: boolean;
    online_url?: string;
    community_id?: string;
    cover_url?: string;
  }
) {
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      creator_id: creatorId,
      title: data.title,
      description: data.description || null,
      location: data.location || null,
      start_at: data.start_at,
      end_at: data.end_at || null,
      is_online: data.is_online || false,
      online_url: data.online_url || null,
      community_id: data.community_id || null,
      cover_url: data.cover_url || null,
      attendee_count: 0,
    })
    .select(EVENT_SELECT)
    .single();

  if (error) throw error;

  // Auto-RSVP the host as "going" — they're hosting, of course they're going.
  // Trigger recomputes attendee_count.
  await supabase
    .from("event_rsvps")
    .upsert(
      { event_id: (event as { id: string }).id, user_id: creatorId, status: "going" },
      { onConflict: "event_id,user_id" }
    );

  return event;
}

// ── Event comments ──────────────────────────────────────────────────

export interface EventComment {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

const COMMENT_SELECT = `
  id, event_id, user_id, content, created_at, parent_id,
  profiles!event_comments_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  )
`;

export async function getEventComments(eventId: string, limit = 100) {
  const { data, error } = await supabase
    .from("event_comments")
    .select(COMMENT_SELECT)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data as unknown as EventComment[];
}

export async function postEventComment(
  eventId: string,
  userId: string,
  content: string,
  parentId?: string | null
) {
  const { data, error } = await supabase
    .from("event_comments")
    .insert({
      event_id: eventId,
      user_id: userId,
      content,
      parent_id: parentId ?? null,
    })
    .select(COMMENT_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as EventComment;
}

export async function deleteEventComment(commentId: string) {
  const { error } = await supabase
    .from("event_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw error;
}

export async function rsvpEvent(
  eventId: string,
  userId: string,
  status: "going" | "interested" | "not_going"
) {
  const { error } = await supabase
    .from("event_rsvps")
    .upsert(
      {
        event_id: eventId,
        user_id: userId,
        status,
      },
      { onConflict: "event_id,user_id" }
    );

  if (error) throw error;
}

export async function removeRsvp(eventId: string, userId: string) {
  const { error } = await supabase
    .from("event_rsvps")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getEventAttendees(eventId: string, limit = 20) {
  const { data, error } = await supabase
    .from("event_rsvps")
    .select(
      `
      event_id, user_id, status, created_at,
      profiles!event_rsvps_user_id_fkey (
        id, username, display_name, avatar_url, is_verified
      )
    `
    )
    .eq("event_id", eventId)
    .in("status", ["going", "interested"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as EventAttendee[];
}

export async function getUserRsvpStatus(eventId: string, userId: string) {
  const { data, error } = await supabase
    .from("event_rsvps")
    .select("status")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.status as "going" | "interested" | "not_going" | null;
}
