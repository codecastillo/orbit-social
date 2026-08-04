import { supabase } from "@/lib/supabase";

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

export async function getNotifications(
  userId: string,
  cursor?: string,
  limit = NOTIFICATION_PAGE_SIZE,
): Promise<NotificationWithActor[]> {
  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  // Through unknown: the literal-type query parser infers the to-one
  // profiles join as an array without generated DB types.
  return (data ?? []) as unknown as NotificationWithActor[];
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
