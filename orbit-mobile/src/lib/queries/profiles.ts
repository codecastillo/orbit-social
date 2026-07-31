import { supabase } from "@/lib/supabase";

const PROFILE_SELECT = `
  id, username, display_name, avatar_url, bio, location, website, is_verified,
  follower_count, following_count, post_count, created_at,
  theme_color, avatar_border
`;

// Same union as the web UserAvatar (src/components/shared/user-avatar.tsx).
// gradient-rainbow and animated-glow are legacy values no longer offered,
// but stored rows still carry them.
export type AvatarBorderStyle =
  | "none"
  | "gradient-rainbow"
  | "gold"
  | "silver"
  | "diamond"
  | "animated-glow";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  post_count: number;
  created_at: string;
  theme_color: string | null;
  avatar_border: string | null;
}

export interface ProfilePostMedia {
  id: string;
  type: "image" | "video" | "gif";
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
}

export interface ProfilePost {
  id: string;
  content: string | null;
  type: "text" | "image" | "video" | "poll" | "quote" | "reel" | "repost";
  created_at: string;
  post_media: ProfilePostMedia[];
}

export async function getOwnProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Profile | null;
}

export async function getProfileByUsername(
  username: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Profile | null;
}

export interface ProfileUpdates {
  username?: string;
  display_name?: string;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  avatar_url?: string;
  theme_color?: string | null;
  avatar_border?: AvatarBorderStyle;
}

export async function updateOwnProfile(
  userId: string,
  updates: ProfileUpdates,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as Profile;
}

/**
 * Uploads a picked image to the same avatars bucket and path the web
 * onboarding flow uses (`${userId}/avatar.${ext}`, upsert) and returns the
 * public URL to store on profiles.avatar_url.
 */
export async function uploadAvatar(
  userId: string,
  uri: string,
  mimeType?: string,
): Promise<string> {
  const ext = mimeType?.split("/")[1] ?? uri.split(".").pop() ?? "jpg";
  const path = `${userId}/avatar.${ext}`;
  const body = await fetch(uri).then((response) => response.arrayBuffer());
  const { error } = await supabase.storage.from("avatars").upload(path, body, {
    contentType: mimeType ?? "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

/**
 * The signup trigger seeds username as "user_" plus the first 8 chars of the
 * auth id; that placeholder means web onboarding never ran for this account.
 */
export function hasPlaceholderUsername(profile: Profile): boolean {
  return profile.username === `user_${profile.id.slice(0, 8)}`;
}

export async function followUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
}

export async function unfollowUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);
  if (error) throw error;
}

export async function checkFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

// Mirrors the web bell queries in src/lib/queries/social.ts: subscribe to a
// creator's new posts via post_notification_subscriptions.
export async function checkPostNotificationSubscription(
  userId: string,
  creatorId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("post_notification_subscriptions")
    .select("creator_id")
    .eq("user_id", userId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function subscribeToCreatorPosts(
  userId: string,
  creatorId: string,
) {
  const { error } = await supabase
    .from("post_notification_subscriptions")
    .insert({ user_id: userId, creator_id: creatorId });
  if (error) throw error;
}

export async function unsubscribeFromCreatorPosts(
  userId: string,
  creatorId: string,
) {
  const { error } = await supabase
    .from("post_notification_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("creator_id", creatorId);
  if (error) throw error;
}

// Mirrors the web getUserPosts filters (top-level, non-community, no clips or
// reposts). Media feeds the profile grid tab; the list tab only needs text.
export async function getUserRecentPosts(
  userId: string,
  limit = 60,
): Promise<ProfilePost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, content, type, created_at,
       post_media ( id, type, url, thumbnail_url, width, height, sort_order )`,
    )
    .eq("user_id", userId)
    .is("reply_to_id", null)
    .is("community_id", null)
    .eq("is_hidden", false)
    .not("type", "in", "(reel,repost)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ProfilePost[];
}

export interface MentionPost {
  id: string;
  content: string | null;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export async function getUserClips(
  userId: string,
  limit = 60,
): Promise<ProfilePost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, content, type, created_at,
       post_media ( id, type, url, thumbnail_url, width, height, sort_order )`,
    )
    .eq("user_id", userId)
    .eq("type", "reel")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ProfilePost[];
}

// Posts by others whose text mentions @username. There is no mentions table;
// the notification trigger parses content the same way.
export async function getUserMentions(
  username: string,
  userId: string,
  limit = 60,
): Promise<MentionPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, content, created_at,
       profiles!posts_user_id_fkey ( username, display_name, avatar_url )`,
    )
    .ilike("content", `%@${username}%`)
    .neq("user_id", userId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as MentionPost[];
}
