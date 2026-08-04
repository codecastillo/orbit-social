import { createClient } from "@/lib/supabase/client";
import type { PostWithAuthor } from "@/lib/queries/posts";

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

/**
 * A row that embeds a single profile. Without generated DB types the
 * literal-type query parser reads the to-one join as an array, so rows are
 * asserted to this shape at the query boundary.
 */
interface ProfileJoinRow {
  created_at: string;
  profiles: ProfileSummary;
}

export interface TrendingHashtag {
  id: string;
  name: string;
  post_count: number;
}

// ── Follows ──────────────────────────────────────────────────────────

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
  targetIsPrivate?: boolean
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

// ── Follow requests ──────────────────────────────────────────────────

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
  targetId: string
) {
  const { error } = await supabase
    .from("follow_requests")
    .delete()
    .eq("requester_id", requesterId)
    .eq("target_id", targetId);
  if (error) throw error;
}

export async function checkFollowRequests(
  requesterId: string,
  targetIds: string[]
) {
  if (targetIds.length === 0) return new Set<string>();
  const { data, error } = await supabase
    .from("follow_requests")
    .select("target_id")
    .eq("requester_id", requesterId)
    .in("target_id", targetIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.target_id));
}

/** Resolves the button state for one target in a single round trip each way. */
export async function getFollowState(
  followerId: string,
  targetId: string
): Promise<FollowState> {
  const [following, requested] = await Promise.all([
    checkFollowing(followerId, [targetId]),
    checkFollowRequests(followerId, [targetId]),
  ]);
  if (following.has(targetId)) return "following";
  if (requested.has(targetId)) return "requested";
  return "none";
}

/** Same as getFollowState, batched for a list of rows. */
export async function checkFollowStates(
  followerId: string,
  targetIds: string[]
): Promise<Map<string, FollowState>> {
  const states = new Map<string, FollowState>();
  if (targetIds.length === 0) return states;

  const [following, requested] = await Promise.all([
    checkFollowing(followerId, targetIds),
    checkFollowRequests(followerId, targetIds),
  ]);
  for (const id of targetIds) {
    if (following.has(id)) states.set(id, "following");
    else if (requested.has(id)) states.set(id, "requested");
    else states.set(id, "none");
  }
  return states;
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
  targetIsPrivate?: boolean
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

export async function getIncomingFollowRequests(
  userId: string
): Promise<FollowRequest[]> {
  const { data, error } = await supabase
    .from("follow_requests")
    .select(`created_at, profiles!follow_requests_requester_id_fkey (${PROFILE_SELECT})`)
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

// ── Post notification bell ───────────────────────────────────────────

export async function checkPostNotificationSubscription(
  userId: string,
  creatorId: string
) {
  const { data, error } = await supabase
    .from("post_notification_subscriptions")
    .select("creator_id")
    .eq("user_id", userId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function subscribeToCreatorPosts(userId: string, creatorId: string) {
  const { error } = await supabase
    .from("post_notification_subscriptions")
    .insert({ user_id: userId, creator_id: creatorId });
  if (error) throw error;
}

export async function unsubscribeFromCreatorPosts(userId: string, creatorId: string) {
  const { error } = await supabase
    .from("post_notification_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("creator_id", creatorId);
  if (error) throw error;
}

// ── Blocks ───────────────────────────────────────────────────────────

export async function blockUser(blockerId: string, blockedId: string, expiresAt?: string) {
  const { error } = await supabase
    .from("blocks")
    .insert({
      blocker_id: blockerId,
      blocked_id: blockedId,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    });
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

export async function getBlockedUsers(userId: string) {
  const { data, error } = await supabase
    .from("blocks")
    .select(`created_at, profiles!blocks_blocked_id_fkey (${PROFILE_SELECT})`)
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { profiles: ProfileSummary | null }[])
    .map((row) => row.profiles)
    .filter((p): p is ProfileSummary => p !== null);
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
 * Query keys that go stale the moment a block lands: the trigger severs
 * follows and close friends in both directions, and the posts policy starts
 * hiding content, so counts, lists, feeds, and suggestions all shift.
 */
export const BLOCK_INVALIDATION_KEYS: readonly string[][] = [
  ["feed"],
  ["feed-suggestions"],
  ["suggested-users"],
  ["follow-list"],
  ["followers"],
  ["following"],
  ["check-following"],
  ["viewer-follows"],
  ["profile-meta"],
  ["profile-tab-counts"],
  ["follow-states"],
  ["follow-state"],
  ["blocked-ids"],
  ["blocked-users"],
];

// ── Mutes ────────────────────────────────────────────────────────────

export async function muteUser(userId: string, mutedId: string, expiresAt?: string) {
  const { error } = await supabase
    .from("mutes")
    .insert({
      user_id: userId,
      muted_id: mutedId,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    });
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

export async function getMutedUsers(userId: string) {
  const { data, error } = await supabase
    .from("mutes")
    .select(`created_at, profiles!mutes_muted_id_fkey (${PROFILE_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { profiles: ProfileSummary | null }[])
    .map((row) => row.profiles)
    .filter((p): p is ProfileSummary => p !== null);
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

  return ((data ?? []) as unknown as ProfileJoinRow[]).map((row) => ({
    ...row.profiles,
    followed_at: row.created_at,
  }));
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

/** Query keys holding follower lists or counts that a removal invalidates. */
export const FOLLOWER_INVALIDATION_KEYS: readonly string[][] = [
  ["followers"],
  ["follow-list"],
  ["follow-list-status"],
  ["follow-states"],
  ["profile-meta"],
  ["profile-tab-counts"],
];

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

  return ((data ?? []) as unknown as ProfileJoinRow[]).map((row) => ({
    ...row.profiles,
    followed_at: row.created_at,
  }));
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
      .is("deactivated_at", null)
      .order("follower_count", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as ProfileSummary[];
  }

  // Get users that your followings follow. The embedded filter drops a
  // deactivated account's profile to null, and the loop below already skips
  // rows without one.
  const { data: suggestions, error } = await supabase
    .from("follows")
    .select(`profiles!follows_following_id_fkey (${PROFILE_SELECT})`)
    .is("profiles.deactivated_at", null)
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

// websearch-mode FTS has no prefix matching, so a 1-2 char fragment
// matches nothing; those stay on the ilike substring path. #tag and
// @mention queries stay on ilike too: to_tsvector strips the sigil, which
// would turn "#run" into a plain "run" search.
const FTS_MIN_QUERY_LENGTH = 3;

function isFtsQuery(query: string) {
  return (
    query.length >= FTS_MIN_QUERY_LENGTH &&
    !query.startsWith("#") &&
    !query.startsWith("@")
  );
}

export async function searchUsers(query: string, limit = 20) {
  const term = `%${query}%`;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .or(`username.ilike.${term},display_name.ilike.${term}`)
    .is("deactivated_at", null)
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
    id, type, url, thumbnail_url, width, height, blurhash, sort_order,
    duration_ms
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
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (isFtsQuery(query)) {
    // Generated posts.search_vector column (GIN-indexed). websearch mode
    // gives users quoted phrases, OR, and -exclusion for free. supabase-js
    // cannot order by ts_rank without an RPC, so matches are ordered by
    // recency rather than a faked relevance sort.
    q = q.textSearch("search_vector", query, { type: "websearch" });
  } else {
    q = q.ilike("content", `%${query}%`);
  }

  if (cursor) {
    q = q.lt("created_at", cursor);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// ── Trending ─────────────────────────────────────────────────────────

// "Trending" is only meaningful when something is actually moving right
// now. Count hashtag uses from posts created in the last 24h, group, and
// rank by recent count. Hashtags that haven't been used today drop out
// entirely so the hero card shows the empty-state instead of stale tags.
export async function getTrendingHashtags(limit = 10) {
  // 24h first; a small network starves that window, so widen to 30 days
  // before giving up. An active platform naturally stays on the tight one.
  const day = 24 * 60 * 60 * 1000;
  for (const windowMs of [day, 30 * day]) {
    const tags = await getTrendingHashtagsSince(
      new Date(Date.now() - windowMs).toISOString(),
      limit,
    );
    if (tags.length > 0) return tags;
  }
  return [];
}

async function getTrendingHashtagsSince(cutoff: string, limit: number) {
  const { data, error } = await supabase
    .from("post_hashtags")
    .select(
      "hashtag_id, hashtags!inner(id, name), posts!inner(created_at, is_hidden)",
    )
    .eq("posts.is_hidden", false)
    .gte("posts.created_at", cutoff);

  if (error) throw error;

  const counts = new Map<string, { id: string; name: string; post_count: number }>();
  for (const row of (data ?? []) as Array<{
    hashtag_id: string;
    hashtags: { id: string; name: string } | { id: string; name: string }[] | null;
  }>) {
    const tag = Array.isArray(row.hashtags) ? row.hashtags[0] : row.hashtags;
    if (!tag) continue;
    const prev = counts.get(tag.id);
    if (prev) prev.post_count += 1;
    else counts.set(tag.id, { id: tag.id, name: tag.name, post_count: 1 });
  }

  return Array.from(counts.values())
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, limit) as TrendingHashtag[];
}

// ── Trending Posts ──────────────────────────────────────────────────

export async function getTrendingPosts(limit = 20) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_hidden", false)
    // Trending should only ever surface root content, never replies/
    // comments. reply_to_id IS NULL filters those out.
    .is("reply_to_id", null)
    .in("type", ["text", "image", "video", "reel", "poll", "quote"])
    .gte("created_at", cutoff)
    .order("like_count", { ascending: false })
    .limit(limit * 3); // over-fetch so we can re-rank

  if (error) throw error;

  // Re-rank by engagement score: likes + comments*2 + reposts*3
  const ranked = ((data ?? []) as unknown as PostWithAuthor[])
    .map((post) => ({
      ...post,
      _engagement: post.like_count + post.comment_count * 2 + post.repost_count * 3,
    }))
    .sort((a, b) => b._engagement - a._engagement)
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

// ── Combined Suggestions (merged algorithm) ────────────────────────

export async function getCombinedSuggestions(
  userId: string,
  limit = 12
): Promise<(ProfileSummary & { mutualCount?: number })[]> {
  // Run both algorithms in parallel and merge results
  const [networkSuggestions, engagementSuggestions] = await Promise.all([
    getSuggestedUsers(userId, limit).catch(() => [] as ProfileSummary[]),
    getEngagementBasedSuggestions(userId, limit).catch(() => [] as ProfileSummary[]),
  ]);

  // Get mutual follow counts for all candidates
  const { data: myFollows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  const myFollowingIds = new Set((myFollows ?? []).map((f) => f.following_id));

  // Merge and deduplicate, combining scores
  const scoreMap = new Map<
    string,
    { profile: ProfileSummary; score: number; mutualCount: number }
  >();

  // Network suggestions get base score of 10 + position bonus
  for (let i = 0; i < networkSuggestions.length; i++) {
    const p = networkSuggestions[i];
    scoreMap.set(p.id, {
      profile: p,
      score: 10 + (networkSuggestions.length - i),
      mutualCount: 0,
    });
  }

  // Engagement suggestions get base score of 8 + position bonus
  for (let i = 0; i < engagementSuggestions.length; i++) {
    const p = engagementSuggestions[i];
    const existing = scoreMap.get(p.id);
    if (existing) {
      existing.score += 8 + (engagementSuggestions.length - i);
    } else {
      scoreMap.set(p.id, {
        profile: p,
        score: 8 + (engagementSuggestions.length - i),
        mutualCount: 0,
      });
    }
  }

  // Calculate mutual follow counts for each candidate
  const candidateIds = Array.from(scoreMap.keys());
  if (candidateIds.length > 0 && myFollowingIds.size > 0) {
    const { data: candidateFollowers } = await supabase
      .from("follows")
      .select("following_id, follower_id")
      .in("following_id", candidateIds)
      .in("follower_id", Array.from(myFollowingIds));

    for (const row of candidateFollowers ?? []) {
      const entry = scoreMap.get(row.following_id);
      if (entry) {
        entry.mutualCount++;
        entry.score += 3; // Boost score per mutual
      }
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((v) => ({ ...v.profile, mutualCount: v.mutualCount }));
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
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const likedPostIds = (myLikes ?? []).map((l) => l.post_id);

  const sharedInterestMap = new Map<string, number>();

  if (likedPostIds.length > 0) {
    const { data: coLikers } = await supabase
      .from("post_likes")
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
      .is("deactivated_at", null)
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
      .is("deactivated_at", null)
      .order("follower_count", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as ProfileSummary[];
  }

  // Fetch profiles for candidates
  const { data: candidateProfiles, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .in("id", Array.from(candidateIds))
    .is("deactivated_at", null);

  if (error) throw error;

  // Score candidates: shared_interests * 3 + location * 2 + engagement_weight
  const scored = ((candidateProfiles ?? []) as ProfileSummary[]).map((p) => {
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

// ── Close Friends ──────────────────────────────────────────────────

export async function getCloseFriends(userId: string) {
  const { data, error } = await supabase
    .from("close_friends")
    .select(
      `
      friend_id,
      created_at,
      profiles:profiles!close_friends_friend_id_fkey (
        ${PROFILE_SELECT}
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as ProfileJoinRow[]).map(
    (row) => row.profiles
  );
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

export async function checkCloseFriends(
  userId: string,
  friendIds: string[]
): Promise<Set<string>> {
  if (friendIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("close_friends")
    .select("friend_id")
    .eq("user_id", userId)
    .in("friend_id", friendIds);

  if (error) throw error;
  return new Set((data ?? []).map((cf) => cf.friend_id));
}
