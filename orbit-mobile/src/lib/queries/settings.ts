import { supabase } from "@/lib/supabase";

// The per-type columns the web notification settings page manages, plus
// quiet hours. Hours are local wall-clock 0-23; the stored offset lets the
// push fanout reconstruct local time from UTC.
export const NOTIFICATION_TOGGLE_KEYS = [
  "likes",
  "comments",
  "follows",
  "mentions",
  "messages",
  "reposts",
  "live_streams",
  "events",
  "marketplace",
  "communities",
  "story_replies",
  "new_followers_posts",
] as const;

export type NotificationToggleKey = (typeof NOTIFICATION_TOGGLE_KEYS)[number];

export interface NotificationPrefs
  extends Record<NotificationToggleKey, boolean> {
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  ...(Object.fromEntries(
    NOTIFICATION_TOGGLE_KEYS.map((key) => [key, true]),
  ) as Record<NotificationToggleKey, boolean>),
  quiet_hours_enabled: false,
  // 10 PM to 8 AM: the window most people mean by "quiet hours".
  quiet_hours_start: 22,
  quiet_hours_end: 8,
};

export async function getNotificationPrefs(
  userId: string,
): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      `${NOTIFICATION_TOGGLE_KEYS.join(", ")}, quiet_hours_enabled, quiet_hours_start, quiet_hours_end`,
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_NOTIFICATION_PREFS;
  const row = data as unknown as Record<string, boolean | number | null>;
  return {
    ...(Object.fromEntries(
      NOTIFICATION_TOGGLE_KEYS.map((key) => [key, row[key] ?? true]),
    ) as Record<NotificationToggleKey, boolean>),
    quiet_hours_enabled:
      (row.quiet_hours_enabled as boolean | null) ?? false,
    quiet_hours_start:
      (row.quiet_hours_start as number | null) ??
      DEFAULT_NOTIFICATION_PREFS.quiet_hours_start,
    quiet_hours_end:
      (row.quiet_hours_end as number | null) ??
      DEFAULT_NOTIFICATION_PREFS.quiet_hours_end,
  };
}

export async function saveNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
) {
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: userId,
    ...prefs,
    timezone_offset_minutes: new Date().getTimezoneOffset() * -1,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export interface BlockedProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

const PROFILE_SELECT = "id, username, display_name, avatar_url";

export async function getBlockedUsers(
  userId: string,
): Promise<BlockedProfile[]> {
  const { data, error } = await supabase
    .from("blocks")
    .select(`created_at, profiles!blocks_blocked_id_fkey (${PROFILE_SELECT})`)
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as { profiles: BlockedProfile | null }[])
    .map((row) => row.profiles)
    .filter((p): p is BlockedProfile => p !== null);
}

export async function getMutedUsers(
  userId: string,
): Promise<BlockedProfile[]> {
  const { data, error } = await supabase
    .from("mutes")
    .select(`created_at, profiles!mutes_muted_id_fkey (${PROFILE_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as { profiles: BlockedProfile | null }[])
    .map((row) => row.profiles)
    .filter((p): p is BlockedProfile => p !== null);
}

// Mirrors the web getCloseFriends in src/lib/queries/social.ts: rows where
// user_id is you, joined to the friend's profile, newest first.
export async function getCloseFriends(
  userId: string,
): Promise<BlockedProfile[]> {
  const { data, error } = await supabase
    .from("close_friends")
    .select(
      `created_at, profiles!close_friends_friend_id_fkey (${PROFILE_SELECT})`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as { profiles: BlockedProfile | null }[])
    .map((row) => row.profiles)
    .filter((p): p is BlockedProfile => p !== null);
}

export async function addCloseFriend(userId: string, friendId: string) {
  const { error } = await supabase
    .from("close_friends")
    .insert({ user_id: userId, friend_id: friendId });

  if (error) throw error;
}

export async function removeCloseFriend(userId: string, friendId: string) {
  const { error } = await supabase
    .from("close_friends")
    .delete()
    .eq("user_id", userId)
    .eq("friend_id", friendId);

  if (error) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);

  if (error) throw error;
}

export async function unmuteUser(userId: string, mutedId: string) {
  const { error } = await supabase
    .from("mutes")
    .delete()
    .eq("user_id", userId)
    .eq("muted_id", mutedId);

  if (error) throw error;
}
