import { supabase } from "@/lib/supabase";

// The per-type columns the web notification settings page manages, plus the
// email digest opt-out and quiet hours. Hours are local wall-clock 0-23; the
// stored offset lets the push fanout reconstruct local time from UTC.
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
  "email_digest",
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

/**
 * The blocks the viewer owns. Expiry is deliberately ignored so this matches
 * `blocks_between`, which enforces every row regardless of `expires_at`; a
 * client that hid expired rows would promise sends the server still refuses.
 */
export async function getBlockedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.blocked_id));
}

/**
 * The accounts the viewer muted, for the feed and clip filters. Mutes are
 * enforced entirely on the client, so timed mutes expire here.
 */
export async function getMutedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("mutes")
    .select("muted_id")
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.muted_id));
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

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });

  if (error) throw error;
}

export async function muteUser(userId: string, mutedId: string) {
  const { error } = await supabase
    .from("mutes")
    .insert({ user_id: userId, muted_id: mutedId });

  if (error) throw error;
}

/**
 * Caches a block invalidates. The database trigger severs follows and close
 * friends in both directions and the posts policy starts hiding content, so
 * follow state, counts, lists, feeds, clips, and suggestions all shift.
 * Mirrors the web BLOCK_INVALIDATION_KEYS with this app's key names.
 */
export const BLOCK_INVALIDATION_KEYS: readonly string[][] = [
  ["feed"],
  ["clips"],
  ["curated-clips"],
  ["suggested-users"],
  ["follow-list"],
  ["follow-state"],
  ["follow-requests"],
  ["profile"],
  ["own-profile"],
  ["profile-posts"],
  ["profile-clips"],
  ["visible-post-count"],
  ["blocked-ids"],
  ["blocked-users"],
];

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
