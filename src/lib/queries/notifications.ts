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
  // Hydrated post-fetch by getNotifications() for entity_type='post'.
  // Lets the UI distinguish "your clip" vs "your post" vs "your post
  // in <room>" without an N+1 on render.
  entity_post?: {
    id: string;
    type: string;
    community_id: string | null;
    community_name: string | null;
  } | null;
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

  const rows = (data ?? []) as NotificationWithActor[];

  // Hydrate post metadata for any notification whose entity is a post:
  // a single batch fetch covers like/comment/mention/repost notifs and
  // gives us type (reel vs other) + community context for nicer copy.
  const postIds = Array.from(
    new Set(
      rows
        .filter((r) => r.entity_type === "post" && r.entity_id)
        .map((r) => r.entity_id as string),
    ),
  );

  if (postIds.length > 0) {
    const { data: posts } = await supabase
      .from("posts")
      .select("id, type, community_id, communities ( name )")
      .in("id", postIds);

    const map = new Map<
      string,
      NonNullable<NotificationWithActor["entity_post"]>
    >();
    for (const p of (posts ?? []) as unknown as Array<{
      id: string;
      type: string;
      community_id: string | null;
      // Supabase returns embedded relations as an array even for the
      // many-to-one direction, hence the array shape.
      communities: { name: string | null }[] | { name: string | null } | null;
    }>) {
      const community = Array.isArray(p.communities)
        ? p.communities[0] ?? null
        : p.communities;
      map.set(p.id, {
        id: p.id,
        type: p.type,
        community_id: p.community_id,
        community_name: community?.name ?? null,
      });
    }
    for (const r of rows) {
      if (r.entity_type === "post" && r.entity_id) {
        r.entity_post = map.get(r.entity_id) ?? null;
      }
    }
  }

  return rows;
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
