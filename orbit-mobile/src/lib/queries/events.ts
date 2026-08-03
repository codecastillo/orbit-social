import { supabase } from "@/lib/supabase";

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

export type RsvpStatus = "going" | "interested" | "not_going";

export interface EventAttendee {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
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

export async function getEvents(limit = 30) {
  // Local-day floor, matching the web list: an event created for "today 1pm"
  // still appears even if the user opens the list at 2pm.
  const todayFloor = new Date();
  todayFloor.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_at", todayFloor.toISOString())
    .order("start_at", { ascending: true })
    .limit(limit);

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

// Display and credit only for v1: the events UPDATE policy is creator-only,
// so co-hosts cannot edit the event. Rows are managed by the host (the
// event_cohosts RLS checks events.creator_id).
export interface EventCohost {
  event_id: string;
  user_id: string;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

export async function getEventCohosts(eventId: string) {
  const { data, error } = await supabase
    .from("event_cohosts")
    .select(
      `
      event_id, user_id, created_at,
      profiles!event_cohosts_user_id_fkey (
        id, username, display_name, avatar_url, is_verified
      )
    `,
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as unknown as EventCohost[];
}

export async function addEventCohost(eventId: string, userId: string) {
  const { error } = await supabase
    .from("event_cohosts")
    .upsert(
      { event_id: eventId, user_id: userId },
      { onConflict: "event_id,user_id" },
    );
  if (error) throw error;
}

export async function removeEventCohost(eventId: string, userId: string) {
  const { error } = await supabase
    .from("event_cohosts")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function createEvent(
  creatorId: string,
  data: {
    title: string;
    description?: string;
    location?: string;
    start_at: string;
    cover_url?: string;
  },
) {
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      creator_id: creatorId,
      title: data.title,
      description: data.description || null,
      location: data.location || null,
      start_at: data.start_at,
      end_at: null,
      is_online: false,
      online_url: null,
      community_id: null,
      cover_url: data.cover_url || null,
      attendee_count: 0,
    })
    .select("id")
    .single();

  if (error) throw error;
  const created = event as { id: string };

  // Auto-RSVP the host as "going", matching the web create flow. The
  // event_rsvps trigger recomputes attendee_count.
  await supabase
    .from("event_rsvps")
    .upsert(
      { event_id: created.id, user_id: creatorId, status: "going" },
      { onConflict: "event_id,user_id" },
    );

  return created;
}

export async function uploadEventCover(
  userId: string,
  uri: string,
  mimeType: string,
): Promise<string> {
  // The web app has no event cover upload yet; reuse the covers bucket,
  // whose RLS gates writes by uid first path segment.
  const ext = mimeType.split("/")[1] ?? "jpg";
  const path = `${userId}/events/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const response = await fetch(uri);
  const body = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from("covers")
    .upload(path, body, { contentType: mimeType });
  if (error) throw error;

  const { data } = supabase.storage.from("covers").getPublicUrl(path);
  return data.publicUrl;
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
    `,
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
  return (data?.status as RsvpStatus | null) ?? null;
}

export async function rsvpEvent(eventId: string, userId: string, status: RsvpStatus) {
  // Trigger on event_rsvps recomputes events.attendee_count.
  const { error } = await supabase
    .from("event_rsvps")
    .upsert(
      { event_id: eventId, user_id: userId, status },
      { onConflict: "event_id,user_id" },
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

// ── Event comments ───────────────────────────────────────────────────
// Mirrors src/lib/queries/events.ts on the web: flat list ordered oldest
// first, one reply level via parent_id.

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
  parentId?: string | null,
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

// ── Friends going ────────────────────────────────────────────────────

export interface FriendsGoing {
  count: number;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  }[];
}

// Attendee ids are capped so a huge event can't blow up the follows .in()
// filter; past that point "N people you follow" is an undercount, which is
// fine for a social proof row.
const FRIENDS_GOING_ATTENDEE_CAP = 500;

export async function getFriendsGoing(
  eventId: string,
  viewerId: string,
): Promise<FriendsGoing> {
  const { data: rsvps, error } = await supabase
    .from("event_rsvps")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("status", "going")
    .neq("user_id", viewerId)
    .limit(FRIENDS_GOING_ATTENDEE_CAP);
  if (error) throw error;

  const attendeeIds = (rsvps ?? []).map((r) => r.user_id);
  if (!attendeeIds.length) return { count: 0, profiles: [] };

  const { data: follows, error: followsError } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .in("following_id", attendeeIds);
  if (followsError) throw followsError;

  const followedIds = (follows ?? []).map((f) => f.following_id);
  if (!followedIds.length) return { count: 0, profiles: [] };

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", followedIds.slice(0, 3));
  if (profilesError) throw profilesError;

  return {
    count: followedIds.length,
    profiles: (profiles ?? []) as FriendsGoing["profiles"],
  };
}
