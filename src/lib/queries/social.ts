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

// ── Trending Posts ──────────────────────────────────────────────────

export async function getTrendingPosts(limit = 20) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_hidden", false)
    .gte("created_at", cutoff)
    .order("like_count", { ascending: false })
    .limit(limit * 3); // over-fetch so we can re-rank

  if (error) throw error;

  // Re-rank by engagement score: likes + comments*2 + reposts*3
  const ranked = (data ?? [])
    .map((post: any) => ({
      ...post,
      _engagement: post.like_count + post.comment_count * 2 + post.repost_count * 3,
    }))
    .sort((a: any, b: any) => b._engagement - a._engagement)
    .slice(0, limit);

  return ranked;
}

// ── Mutual Follows ──────────────────────────────────────────────────

export async function getMutualFollows(
  userId: string,
  targetUserId: string,
  limit = 3
) {
  // Get who the current user follows
  const { data: myFollows, error: err1 } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (err1) throw err1;

  const myFollowingIds = (myFollows ?? []).map((f) => f.following_id);
  if (myFollowingIds.length === 0) return { users: [] as ProfileSummary[], totalCount: 0 };

  // Get who follows the target user from the set of people you follow
  const { data: mutuals, error: err2 } = await supabase
    .from("follows")
    .select(`profiles!follows_follower_id_fkey (${PROFILE_SELECT})`)
    .eq("following_id", targetUserId)
    .in("follower_id", myFollowingIds);

  if (err2) throw err2;

  const uniqueMap = new Map<string, ProfileSummary>();
  for (const row of mutuals ?? []) {
    const p = row.profiles as unknown as ProfileSummary;
    if (p && !uniqueMap.has(p.id)) {
      uniqueMap.set(p.id, p);
    }
  }

  const allMutuals = Array.from(uniqueMap.values());

  return {
    users: allMutuals.slice(0, limit),
    totalCount: allMutuals.length,
  };
}

// ── Engagement-based Suggestions ────────────────────────────────────

export async function getEngagementBasedSuggestions(
  userId: string,
  limit = 10
) {
  // Get current user's following list + blocked + muted
  const [followsRes, blocksRes, mutesRes, profileRes] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", userId),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
    supabase.from("mutes").select("muted_id").eq("user_id", userId),
    supabase.from("profiles").select("location").eq("id", userId).single(),
  ]);

  const followingIds = (followsRes.data ?? []).map((f) => f.following_id);
  const blockedIds = (blocksRes.data ?? []).map((b) => b.blocked_id);
  const mutedIds = (mutesRes.data ?? []).map((m) => m.muted_id);
  const userLocation = profileRes.data?.location ?? null;

  const excludeIds = [userId, ...followingIds, ...blockedIds, ...mutedIds];

  // Strategy 1: Users who liked the same posts as you (shared interests)
  const { data: myLikes } = await supabase
    .from("likes")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const likedPostIds = (myLikes ?? []).map((l) => l.post_id);

  const sharedInterestMap = new Map<string, number>();

  if (likedPostIds.length > 0) {
    const { data: coLikers } = await supabase
      .from("likes")
      .select("user_id")
      .in("post_id", likedPostIds)
      .not("user_id", "in", `(${excludeIds.join(",")})`)
      .limit(200);

    for (const row of coLikers ?? []) {
      sharedInterestMap.set(
        row.user_id,
        (sharedInterestMap.get(row.user_id) ?? 0) + 1
      );
    }
  }

  // Strategy 2: Users in the same location
  const locationMap = new Map<string, number>();

  if (userLocation) {
    const { data: localUsers } = await supabase
      .from("profiles")
      .select("id")
      .ilike("location", `%${userLocation}%`)
      .not("id", "in", `(${excludeIds.join(",")})`)
      .limit(50);

    for (const row of localUsers ?? []) {
      locationMap.set(row.id, 1);
    }
  }

  // Combine candidate IDs
  const candidateIds = new Set([
    ...sharedInterestMap.keys(),
    ...locationMap.keys(),
  ]);

  if (candidateIds.size === 0) {
    // Fallback: popular users not followed/blocked/muted
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .not("id", "in", `(${excludeIds.join(",")})`)
      .order("follower_count", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as ProfileSummary[];
  }

  // Fetch profiles for candidates
  const { data: candidateProfiles, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .in("id", Array.from(candidateIds));

  if (error) throw error;

  // Score candidates: shared_interests * 3 + location * 2 + engagement_weight
  const scored = (candidateProfiles ?? []).map((p: any) => {
    const interestScore = (sharedInterestMap.get(p.id) ?? 0) * 3;
    const locationScore = (locationMap.get(p.id) ?? 0) * 2;
    // Engagement weight: log of follower count to avoid pure popularity bias
    const engagementWeight = Math.log2(1 + (p.follower_count ?? 0));
    return {
      profile: p as ProfileSummary,
      score: interestScore + locationScore + engagementWeight,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.profile);
}
