import { supabase } from "@/lib/supabase";

// The five per-type columns the web notification settings page manages.
export interface NotificationPrefs {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
  messages: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  likes: true,
  comments: true,
  follows: true,
  mentions: true,
  messages: true,
};

export async function getNotificationPrefs(
  userId: string,
): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("likes, comments, follows, mentions, messages")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_NOTIFICATION_PREFS;
  return {
    likes: data.likes ?? true,
    comments: data.comments ?? true,
    follows: data.follows ?? true,
    mentions: data.mentions ?? true,
    messages: data.messages ?? true,
  };
}

export async function saveNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
) {
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: userId,
    ...prefs,
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
