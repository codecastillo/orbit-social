import { supabase } from "@/lib/supabase";
import { getBlockedIds, getMutedIds } from "@/lib/queries/settings";

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "mention"
  | "repost"
  | "quote"
  | "message"
  | "story_reaction"
  | "live_started"
  | "community_invite"
  | "event_invite"
  | "event_reminder"
  | "new_post"
  | "moment_prompt"
  | "follow_request";

export interface NotificationWithActor {
  id: string;
  user_id: string;
  // Null on system-generated rows (moment_prompt), which have no actor.
  actor_id: string | null;
  type: NotificationType;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  } | null;
}

export const NOTIFICATION_PAGE_SIZE = 20;

const NOTIFICATION_SELECT = `
  *,
  profiles!notifications_actor_id_fkey (
    id, username, display_name, avatar_url, is_verified
  )
`;

/**
 * Actors the viewer should never hear from again: accounts they muted, which
 * is what the block/mute dialog promises, and accounts they blocked, whose
 * older rows would otherwise sit in the list forever (notifications have no
 * block-aware RLS the way posts do). Only the viewer's own block rows are
 * readable, so this answers "did I block them", never "did they block me".
 * Mirrors the web src/lib/queries/notifications.ts.
 */
async function getSuppressedActorIds(userId: string): Promise<string[]> {
  const [muted, blocked] = await Promise.all([
    getMutedIds(userId),
    getBlockedIds(userId),
  ]);
  return Array.from(new Set([...muted, ...blocked]));
}

/**
 * PostgREST filter dropping suppressed actors. The `is.null` arm is load
 * bearing: `actor_id NOT IN (...)` is NULL for system rows (moment_prompt),
 * which would drop them from the list.
 */
function suppressedActorFilter(actorIds: string[]): string {
  return `actor_id.is.null,actor_id.not.in.(${actorIds.join(",")})`;
}

export async function getNotifications(
  userId: string,
  cursor?: string,
  limit = NOTIFICATION_PAGE_SIZE,
): Promise<NotificationWithActor[]> {
  const suppressedActorIds = await getSuppressedActorIds(userId);

  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Filtered in the query, not after it, so a full page still counts as full
  // for getNextPageParam and grouping never sees a suppressed row.
  if (suppressedActorIds.length > 0) {
    query = query.or(suppressedActorFilter(suppressedActorIds));
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  // Through unknown: the literal-type query parser infers the to-one
  // profiles join as an array without generated DB types.
  return (data ?? []) as unknown as NotificationWithActor[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const suppressedActorIds = await getSuppressedActorIds(userId);

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  // The badge counts what the list shows, or it sends people to an activity
  // screen with nothing new on it.
  if (suppressedActorIds.length > 0) {
    query = query.or(suppressedActorFilter(suppressedActorIds));
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Clears one row or a whole collapsed group ("Ana and 3 others liked your
 * post") in a single request.
 */
export async function markManyAsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) return;

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .in("id", notificationIds);

  if (error) throw error;
}

export async function markAllAsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;
}
