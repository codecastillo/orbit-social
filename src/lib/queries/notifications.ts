import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface NotificationWithActor {
  id: string;
  user_id: string;
  actor_id: string;
  type:
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
    | "event_reminder";
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
  };
}

const NOTIFICATION_SELECT = `
  *,
  profiles!notifications_actor_id_fkey (
    id, username, display_name, avatar_url, is_verified
  )
`;

export async function getNotifications(
  userId: string,
  cursor?: string,
  limit = 20
) {
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
  return data as NotificationWithActor[];
}

export async function getUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

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
