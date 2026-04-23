import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const PROFILE_SELECT = `
  id, username, display_name, avatar_url, bio, is_verified,
  follower_count, following_count
`;

export interface ProfileSummary {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
}

export interface TrendingHashtag {
  id: string;
  name: string;
  post_count: number;
}

// ── Follows ──────────────────────────────────────────────────────────

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
  followingIds: string[]
) {
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", followerId)
    .in("following_id", followingIds);
  if (error) throw error;
  return new Set(data?.map((f) => f.following_id) ?? []);
}

// ── Blocks ───────────────────────────────────────────────────────────

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
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

// ── Mutes ────────────────────────────────────────────────────────────

export async function muteUser(userId: string, mutedId: string) {
  const { error } = await supabase
    .from("mutes")
    .insert({ user_id: userId, muted_id: mutedId });
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

// ── Follower / Following lists (cursor-paginated) ────────────────────

export async function getFollowers(
  userId: string,
  cursor?: string,
  limit = 20
) {
  let query = supabase
    .from("follows")
    .select(`created_at, profiles!follows_follower_id_fkey (${PROFILE_SELECT})`)
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...(row.profiles as any),
    followed_at: row.created_at,
  })) as (ProfileSummary & { followed_at: string })[];
}

export async function getFollowing(
  userId: string,
  cursor?: string,
  limit = 20
) {
  let query = supabase
    .from("follows")
    .select(
      `created_at, profiles!follows_following_id_fkey (${PROFILE_SELECT})`
    )
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...(row.profiles as any),
    followed_at: row.created_at,
  })) as (ProfileSummary & { followed_at: string })[];
}

// ── Suggestions ──────────────────────────────────────────────────────

export async function getSuggestedUsers(userId: string, limit = 10) {
  // Users followed by people you follow but you don't follow yet
  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  const followingIds = following?.map((f) => f.following_id) ?? [];

  if (followingIds.length === 0) {
    // Fallback: return popular users the current user doesn't follow
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .neq("id", userId)
      .order("follower_count", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as ProfileSummary[];
  }

  // Get users that your followings follow
  const { data: suggestions, error } = await supabase
    .from("follows")
    .select(`profiles!follows_following_id_fkey (${PROFILE_SELECT})`)
    .in("follower_id", followingIds)
    .not("following_id", "in", `(${[userId, ...followingIds].join(",")})`)
    .limit(limit * 3); // over-fetch for dedup

  if (error) throw error;

  // Deduplicate and rank by frequency
  const countMap = new Map<string, { profile: ProfileSummary; count: number }>();
  for (const row of suggestions ?? []) {
    const p = row.profiles as unknown as ProfileSummary;
    if (!p) continue;
    const existing = countMap.get(p.id);
    if (existing) {
      existing.count++;
    } else {
      countMap.set(p.id, { profile: p, count: 1 });
    }
  }

  return Array.from(countMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((v) => v.profile);
}

// ── Search ───────────────────────────────────────────────────────────

export async function searchUsers(query: string, limit = 20) {
  const term = `%${query}%`;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .or(`username.ilike.${term},display_name.ilike.${term}`)
    .order("follower_count", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ProfileSummary[];
}

const POST_SELECT = `
  *,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  post_media (
    id, type, url, thumbnail_url, width, height, blurhash, sort_order
  )
`;

export async function searchPosts(
  query: string,
  cursor?: string,
  limit = 20
) {
  let q = supabase
    .from("posts")
    .select(POST_SELECT)
    .ilike("content", `%${query}%`)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    q = q.lt("created_at", cursor);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// ── Trending ─────────────────────────────────────────────────────────

export async function getTrendingHashtags(limit = 10) {
  const { data, error } = await supabase
    .from("hashtags")
    .select("id, name, post_count")
    .order("post_count", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as TrendingHashtag[];
}
