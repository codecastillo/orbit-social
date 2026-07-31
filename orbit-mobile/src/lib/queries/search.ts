import { supabase } from "@/lib/supabase";

// Mirrors the web PROFILE_SELECT in src/lib/queries/social.ts.
const SUMMARY_SELECT = `
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

export interface SearchPost {
  id: string;
  content: string | null;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  } | null;
}

export async function searchUsers(
  query: string,
  limit = 20,
): Promise<ProfileSummary[]> {
  const term = `%${query}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select(SUMMARY_SELECT)
    .or(`username.ilike.${term},display_name.ilike.${term}`)
    .order("follower_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ProfileSummary[];
}

// Same filter as the web searchPosts, with a lean select for compact rows.
export async function searchPosts(
  query: string,
  limit = 20,
): Promise<SearchPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, content, created_at,
       profiles!posts_user_id_fkey (id, username, display_name, avatar_url, is_verified)`,
    )
    .ilike("content", `%${query}%`)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as SearchPost[];
}

export interface SearchClip {
  id: string;
  content: string | null;
  created_at: string;
  like_count: number;
  post_media: {
    id: string;
    type: "image" | "video" | "gif";
    url: string;
    thumbnail_url: string | null;
    sort_order: number;
  }[];
}

// Reel-only variant of searchPosts, with media included so results can
// render as a thumbnail grid. Limit fills seven 3-column rows.
export async function searchClips(
  query: string,
  limit = 21,
): Promise<SearchClip[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, content, created_at, like_count,
       post_media (id, type, url, thumbnail_url, sort_order)`,
    )
    .ilike("content", `%${query}%`)
    .eq("type", "reel")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as SearchClip[];
}

// Trending only counts hashtag uses from the last 24h, so tags that stopped
// moving drop out instead of lingering (same rule as the web).
export async function getTrendingHashtags(
  limit = 10,
): Promise<TrendingHashtag[]> {
  // 24h first; a small network starves that window, so widen to 30 days
  // before giving up (mirrors the web fallback).
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

async function getTrendingHashtagsSince(
  cutoff: string,
  limit: number,
): Promise<TrendingHashtag[]> {
  const { data, error } = await supabase
    .from("post_hashtags")
    .select(
      "hashtag_id, hashtags!inner(id, name), posts!inner(created_at, is_hidden)",
    )
    .eq("posts.is_hidden", false)
    .gte("posts.created_at", cutoff);
  if (error) throw error;

  const counts = new Map<string, TrendingHashtag>();
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
    .slice(0, limit);
}

// Friends-of-friends suggestions, falling back to popular accounts for users
// who follow nobody yet (mirrors the web getSuggestedUsers).
export async function getSuggestedUsers(
  userId: string,
  limit = 10,
): Promise<ProfileSummary[]> {
  const { data: following, error: followingError } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  if (followingError) throw followingError;

  const followingIds = (following ?? []).map((f) => f.following_id as string);

  if (followingIds.length === 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select(SUMMARY_SELECT)
      .neq("id", userId)
      .order("follower_count", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as ProfileSummary[];
  }

  const { data: suggestions, error } = await supabase
    .from("follows")
    .select(`profiles!follows_following_id_fkey (${SUMMARY_SELECT})`)
    .in("follower_id", followingIds)
    .not("following_id", "in", `(${[userId, ...followingIds].join(",")})`)
    .limit(limit * 3); // over-fetch, then dedupe and rank by frequency
  if (error) throw error;

  const countMap = new Map<string, { profile: ProfileSummary; count: number }>();
  for (const row of suggestions ?? []) {
    const profile = row.profiles as unknown as ProfileSummary | null;
    if (!profile) continue;
    const existing = countMap.get(profile.id);
    if (existing) existing.count += 1;
    else countMap.set(profile.id, { profile, count: 1 });
  }

  return Array.from(countMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => entry.profile);
}
