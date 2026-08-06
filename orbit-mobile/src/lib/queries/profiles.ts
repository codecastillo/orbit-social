import { supabase } from "@/lib/supabase";
import { POST_SELECT, type Post } from "@/lib/queries/posts";
import type { AccountProfile } from "@/lib/accounts";

const PROFILE_SELECT = `
  id, username, display_name, avatar_url, cover_url, bio, location, website,
  pronouns, links, status_text, status_expires_at,
  is_verified, follower_count, following_count, post_count, created_at,
  theme_color, avatar_border, is_private, hide_like_counts, deactivated_at
`;

/** One row of the profile's link list. */
export interface ProfileLink {
  label: string;
  url: string;
}

/**
 * The profile's status, or null when it never had one or the one it had has
 * expired. Nothing clears the text server-side, so every reader has to check
 * the expiry rather than trusting the presence of a string.
 */
export function activeStatus(profile: {
  status_text: string | null;
  status_expires_at: string | null;
}): string | null {
  if (!profile.status_text) return null;
  if (!profile.status_expires_at) return null;
  return new Date(profile.status_expires_at) > new Date()
    ? profile.status_text
    : null;
}

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
  cover_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  pronouns: string | null;
  links: ProfileLink[];
  status_text: string | null;
  status_expires_at: string | null;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  post_count: number;
  created_at: string;
  theme_color: string | null;
  avatar_border: string | null;
  is_private: boolean | null;
  // Viewer-level display setting: hides other people's like counts from
  // this account, never its own.
  hide_like_counts: boolean;
  /** Set while the account is paused; null means active. */
  deactivated_at: string | null;
}

export interface ProfilePostMedia {
  id: string;
  type: "image" | "video" | "gif";
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  duration_ms: number | null;
}

export interface ProfilePost {
  /** Pinned posts already sort first; this is what lets the grid say so. */
  is_pinned: boolean | null;
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

/**
 * The handful of fields the account switcher renders. Narrower than
 * getOwnProfile because it runs on every sign-in, before any screen needs a
 * full profile, and its result is stored next to a credential.
 */
export async function getAccountProfile(
  userId: string,
): Promise<AccountProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    username: data.username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
  };
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

/**
 * Where a handle went after a rename, or null if nobody ever used it.
 * Usernames are stored as typed, so the lookup has to be case-insensitive:
 * ilike does that, wildcards in the handle are escaped so `a_b` cannot match
 * `axb`, and the survivor is re-checked here.
 */
export async function findCurrentUsername(
  oldUsername: string,
): Promise<string | null> {
  const pattern = oldUsername.replace(/[\\%_]/g, (char) => `\\${char}`);
  const { data: history, error } = await supabase
    .from("username_history")
    .select("old_username, user_id")
    .ilike("old_username", pattern)
    .order("changed_at", { ascending: false })
    .limit(5);
  if (error) throw error;

  const match = (history ?? []).find(
    (row) => row.old_username.toLowerCase() === oldUsername.toLowerCase(),
  );
  if (!match) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", match.user_id)
    .maybeSingle();
  if (profileError) throw profileError;
  return profile?.username ?? null;
}

export async function setHideLikeCounts(
  userId: string,
  hidden: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ hide_like_counts: hidden })
    .eq("id", userId);
  if (error) throw error;
}

export interface ProfileUpdates {
  username?: string;
  display_name?: string;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  pronouns?: string | null;
  links?: ProfileLink[];
  status_text?: string | null;
  status_expires_at?: string | null;
  avatar_url?: string;
  cover_url?: string;
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
 * Banner counterpart of uploadAvatar: same bucket and `${userId}/cover.${ext}`
 * path the web settings profile page writes, returning the public URL to
 * store on profiles.cover_url.
 */
export async function uploadCover(
  userId: string,
  uri: string,
  mimeType?: string,
): Promise<string> {
  const ext = mimeType?.split("/")[1] ?? uri.split(".").pop() ?? "jpg";
  const path = `${userId}/cover.${ext}`;
  const body = await fetch(uri).then((response) => response.arrayBuffer());
  const { error } = await supabase.storage.from("covers").upload(path, body, {
    contentType: mimeType ?? "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
}

/**
 * The signup trigger seeds username as "user_" plus the first 8 chars of the
 * auth id; that placeholder means web onboarding never ran for this account.
 */
export function hasPlaceholderUsername(profile: Profile): boolean {
  return profile.username === `user_${profile.id.slice(0, 8)}`;
}

/** What a Follow tap turned into: an immediate follow, or a pending request. */
export type FollowOutcome = "following" | "requested";

/** The three states the follow button can sit in. */
export type FollowState = "none" | "requested" | "following";

async function isPrivateAccount(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_private")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.is_private === true;
}

/**
 * Follows a public account outright; a private one only gets a request the
 * target has to approve. The follows insert policy would happily accept a
 * private target, so honoring privacy is the client's call to make, not
 * something RLS will do for us.
 *
 * Pass `targetIsPrivate` when the caller already has the profile loaded to
 * skip the extra lookup.
 */
export async function followUser(
  followerId: string,
  followingId: string,
  targetIsPrivate?: boolean,
): Promise<FollowOutcome> {
  const isPrivate = targetIsPrivate ?? (await isPrivateAccount(followingId));

  if (isPrivate) {
    await requestFollow(followerId, followingId);
    return "requested";
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
  return "following";
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

export interface FollowRequest {
  requester: ProfileSummary;
  created_at: string;
}

export async function requestFollow(requesterId: string, targetId: string) {
  const { error } = await supabase
    .from("follow_requests")
    .insert({ requester_id: requesterId, target_id: targetId });
  if (error) throw error;
}

/** Used both by the requester (cancel) and the target (deny). */
export async function cancelFollowRequest(
  requesterId: string,
  targetId: string,
) {
  const { error } = await supabase
    .from("follow_requests")
    .delete()
    .eq("requester_id", requesterId)
    .eq("target_id", targetId);
  if (error) throw error;
}

export async function checkFollowRequest(
  requesterId: string,
  targetId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("follow_requests")
    .select("target_id")
    .eq("requester_id", requesterId)
    .eq("target_id", targetId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function getFollowState(
  followerId: string,
  targetId: string,
): Promise<FollowState> {
  const [following, requested] = await Promise.all([
    checkFollowing(followerId, targetId),
    checkFollowRequest(followerId, targetId),
  ]);
  if (following) return "following";
  if (requested) return "requested";
  return "none";
}

/**
 * Advances the Follow -> Requested/Following cycle by one tap and returns the
 * state the button should land on. Every follow surface routes through here so
 * the private-account branch cannot be forgotten in one of them.
 */
export async function toggleFollowState(
  followerId: string,
  targetId: string,
  current: FollowState,
  targetIsPrivate?: boolean,
): Promise<FollowState> {
  if (current === "following") {
    await unfollowUser(followerId, targetId);
    return "none";
  }
  if (current === "requested") {
    await cancelFollowRequest(followerId, targetId);
    return "none";
  }
  return followUser(followerId, targetId, targetIsPrivate);
}

// Mirrors the web ProfileSummary in src/lib/queries/social.ts, minus the
// counts the list rows never render.
export interface ProfileSummary {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
}

const SUMMARY_SELECT = `
  id, username, display_name, avatar_url, bio, is_verified
`;

const FOLLOW_LIST_LIMIT = 100;

export async function getFollowers(
  userId: string,
  limit = FOLLOW_LIST_LIMIT,
): Promise<ProfileSummary[]> {
  const { data, error } = await supabase
    .from("follows")
    .select(`created_at, profiles!follows_follower_id_fkey (${SUMMARY_SELECT})`)
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as { profiles: ProfileSummary | null }[])
    .map((row) => row.profiles)
    .filter((p): p is ProfileSummary => p !== null);
}

/**
 * Drop someone from your own followers. Goes through the RPC because the
 * follows DELETE policy is `auth.uid() = follower_id`, so the person being
 * followed cannot delete the row directly. They are not notified and nothing
 * stops them following again.
 */
export async function removeFollower(followerId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_follower", {
    p_follower: followerId,
  });
  if (error) throw error;
}

export async function getFollowing(
  userId: string,
  limit = FOLLOW_LIST_LIMIT,
): Promise<ProfileSummary[]> {
  const { data, error } = await supabase
    .from("follows")
    .select(
      `created_at, profiles!follows_following_id_fkey (${SUMMARY_SELECT})`,
    )
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as { profiles: ProfileSummary | null }[])
    .map((row) => row.profiles)
    .filter((p): p is ProfileSummary => p !== null);
}

/** Which of the given users the viewer follows, for list button state. */
export async function checkFollowingMany(
  followerId: string,
  followingIds: string[],
): Promise<Set<string>> {
  if (followingIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", followerId)
    .in("following_id", followingIds);
  if (error) throw error;
  return new Set((data ?? []).map((f) => f.following_id));
}

/** Which of the given users have a pending request from the viewer. */
export async function checkFollowRequestsMany(
  requesterId: string,
  targetIds: string[],
): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("follow_requests")
    .select("target_id")
    .eq("requester_id", requesterId)
    .in("target_id", targetIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.target_id));
}

/** Same as getFollowState, batched for a list of rows. */
export async function checkFollowStates(
  followerId: string,
  targetIds: string[],
): Promise<Map<string, FollowState>> {
  const states = new Map<string, FollowState>();
  if (targetIds.length === 0) return states;

  const [following, requested] = await Promise.all([
    checkFollowingMany(followerId, targetIds),
    checkFollowRequestsMany(followerId, targetIds),
  ]);
  for (const id of targetIds) {
    if (following.has(id)) states.set(id, "following");
    else if (requested.has(id)) states.set(id, "requested");
    else states.set(id, "none");
  }
  return states;
}

export async function getIncomingFollowRequests(
  userId: string,
): Promise<FollowRequest[]> {
  const { data, error } = await supabase
    .from("follow_requests")
    .select(
      `created_at, profiles!follow_requests_requester_id_fkey (${SUMMARY_SELECT})`,
    )
    .eq("target_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as {
    created_at: string;
    profiles: ProfileSummary | null;
  }[])
    .filter((row) => row.profiles !== null)
    .map((row) => ({ requester: row.profiles!, created_at: row.created_at }));
}

/**
 * Approving is target-only and has to delete the request and insert the follow
 * together, so it runs as one SECURITY DEFINER call rather than two writes.
 */
export async function approveFollowRequest(requesterId: string) {
  const { error } = await supabase.rpc("approve_follow_request", {
    p_requester: requesterId,
  });
  if (error) throw error;
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

/**
 * Posts this person reposted, liked, or saved: the three profile tabs the web
 * app has had and this client did not.
 *
 * Likes and bookmarks are two queries rather than a join because the ids come
 * from a separate table and Postgres returns the second query in its own
 * order, so the original order is restored from the id list afterwards. Saved
 * is only ever the viewer's own; the tab is hidden for anyone else and the
 * bookmarks RLS policy refuses it regardless.
 */
export async function getUserRepostedPosts(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .eq("type", "repost")
    .is("community_id", null)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as Post[];
}

async function postsByIdPreservingOrder(postIds: string[]) {
  if (postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .in("id", postIds)
    .is("community_id", null)
    .eq("is_hidden", false);
  if (error) throw error;
  const byId = new Map((data ?? []).map((p) => [(p as { id: string }).id, p]));
  return postIds
    .map((id) => byId.get(id))
    .filter(Boolean) as unknown as Post[];
}

export async function getUserLikedPosts(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return postsByIdPreservingOrder((data ?? []).map((l) => l.post_id));
}

export async function getUserBookmarkedPosts(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return postsByIdPreservingOrder((data ?? []).map((b) => b.post_id));
}

export interface EngagementSample {
  view_count: number;
  like_count: number;
  comment_count: number;
  repost_count: number;
}

/**
 * Counts from an author's recent posts, for comparing one post against their
 * own normal. Four integers per row rather than whole posts: the averages
 * need nothing else, and the insights card should not pull media and profile
 * joins it will never render.
 */
export async function getAuthorEngagementSample(
  userId: string,
  limit = 20,
): Promise<EngagementSample[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("view_count, like_count, comment_count, repost_count")
    .eq("user_id", userId)
    .is("reply_to_id", null)
    .is("community_id", null)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EngagementSample[];
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
      `id, content, type, created_at, is_pinned,
       post_media ( id, type, url, thumbnail_url, width, height, sort_order, duration_ms )`,
    )
    .eq("user_id", userId)
    .is("reply_to_id", null)
    .is("community_id", null)
    .eq("is_hidden", false)
    .not("type", "in", "(reel,repost)")
    // Pinned posts lead, like the web profile's pinned section.
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ProfilePost[];
}

/**
 * How many of an account's posts the viewer can actually read, replies and
 * clips included. Compared against the profile's own `post_count` (a counter
 * column, so it is not RLS-filtered) it tells a profile whose content the
 * server is hiding apart from one that simply has nothing to show.
 */
export async function countVisiblePosts(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_hidden", false);
  if (error) throw error;
  return count ?? 0;
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
      `id, content, type, created_at, is_pinned,
       post_media ( id, type, url, thumbnail_url, width, height, sort_order, duration_ms )`,
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
