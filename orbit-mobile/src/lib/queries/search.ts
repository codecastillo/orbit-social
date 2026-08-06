import { supabase } from "@/lib/supabase";
import { POST_SELECT, getPostsByIds, type Post } from "@/lib/queries/posts";
import type { ParsedSearch } from "@/lib/search-query";

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

// Mirrors the web isFtsQuery in src/lib/queries/social.ts. websearch-mode
// FTS has no prefix matching, so a 1-2 char fragment matches nothing;
// those stay on the ilike substring path. #tag and @mention queries stay
// on ilike too: to_tsvector strips the sigil, which would turn "#run"
// into a plain "run" search.
const FTS_MIN_QUERY_LENGTH = 3;

function isFtsQuery(query: string) {
  return (
    query.length >= FTS_MIN_QUERY_LENGTH &&
    !query.startsWith("#") &&
    !query.startsWith("@")
  );
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
    .is("deactivated_at", null)
    .order("follower_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ProfileSummary[];
}

// Same filter as the web searchPosts. Results select the full post shape
// because they render as post cards: a lean select stripped the media, so a
// photo post came back as a line of text with its image missing.
export async function searchPosts(
  query: string,
  limit = 20,
): Promise<Post[]> {
  let q = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (isFtsQuery(query)) {
    // Generated posts.search_vector column (GIN-indexed). websearch mode
    // gives quoted phrases, OR, and -exclusion. supabase-js cannot order
    // by ts_rank without an RPC, so matches are ordered by recency rather
    // than a faked relevance sort.
    q = q.textSearch("search_vector", query, { type: "websearch" });
  } else {
    q = q.ilike("content", `%${query}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Post[];
}

export interface SearchClip {
  id: string;
  user_id: string;
  content: string | null;
  created_at: string;
  like_count: number;
  post_media: {
    id: string;
    type: "image" | "video" | "gif";
    url: string;
    thumbnail_url: string | null;
    sort_order: number;
    duration_ms: number | null;
  }[];
}

// Reel-only variant of searchPosts, with media included so results can
// render as a thumbnail grid. Limit fills seven 3-column rows. Shares the
// post-content search path, so it follows the same FTS/ilike split.
export async function searchClips(
  query: string,
  limit = 21,
): Promise<SearchClip[]> {
  let q = supabase
    .from("posts")
    .select(
      `id, user_id, content, created_at, like_count,
       post_media (id, type, url, thumbnail_url, sort_order, duration_ms)`,
    )
    .eq("type", "reel")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (isFtsQuery(query)) {
    q = q.textSearch("search_vector", query, { type: "websearch" });
  } else {
    q = q.ilike("content", `%${query}%`);
  }
  const { data, error } = await q;
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
      .is("deactivated_at", null)
      .order("follower_count", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as ProfileSummary[];
  }

  // The embedded filter drops a deactivated account's profile to null, and
  // the loop below already skips rows without one.
  const { data: suggestions, error } = await supabase
    .from("follows")
    .select(`profiles!follows_following_id_fkey (${SUMMARY_SELECT})`)
    .is("profiles.deactivated_at", null)
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

/**
 * Resolves the usernames in a `from:` filter to ids. Unknown names resolve to
 * nothing, which correctly returns no results rather than silently dropping
 * the filter and showing everyone's posts.
 */
async function resolveAuthorIds(usernames: string[]): Promise<string[]> {
  if (usernames.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("username", usernames);
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

/**
 * Applies the parsed operators that map to plain column comparisons. The
 * media and link requirements are handled by the caller, since each needs a
 * different shape of filter.
 */
function applyCommonFilters<T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T; not: (c: string, o: string, v: string) => T; in: (c: string, v: string[]) => T }>(
  query: T,
  parsed: ParsedSearch,
  authorIds: string[],
): T {
  let next = query;
  if (authorIds.length > 0) next = next.in("user_id", authorIds);
  if (parsed.after) next = next.gte("created_at", parsed.after);
  if (parsed.before) next = next.lte("created_at", parsed.before);
  for (const word of parsed.exclude) {
    next = next.not("content", "ilike", `%${word}%`);
  }
  return next;
}

/**
 * Posts matching a parsed query. Text still goes through the generated
 * search_vector; everything else narrows the same query with real column
 * filters, which is why the operators are parsed on the client.
 */
export async function searchPostsAdvanced(
  parsed: ParsedSearch,
  limit = 30,
): Promise<Post[]> {
  const authorIds = await resolveAuthorIds(parsed.from);
  if (parsed.from.length > 0 && authorIds.length === 0) return [];

  let q = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  q = applyCommonFilters(q, parsed, authorIds);

  if (parsed.text) {
    q = isFtsQuery(parsed.text)
      ? q.textSearch("search_vector", parsed.text, { type: "websearch" })
      : q.ilike("content", `%${parsed.text}%`);
  }
  // A link lives in the text, so it is a content match rather than a join.
  if (parsed.has.includes("link")) q = q.ilike("content", "%http%");

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as unknown as Post[];
  // Media requirements filter after the fetch: post_media is a to-many join,
  // and PostgREST cannot express "has at least one row of this type" as a
  // filter on the parent without an RPC.
  const wantsImage = parsed.has.includes("image");
  const wantsVideo = parsed.has.includes("video");
  if (wantsImage || wantsVideo) {
    rows = rows.filter((post) =>
      post.post_media.some(
        (m) =>
          (wantsImage && (m.type === "image" || m.type === "gif")) ||
          (wantsVideo && m.type === "video"),
      ),
    );
  }
  return rows;
}

export interface MessageHit {
  id: string;
  conversation_id: string;
  content: string;
  created_at: string;
  sender: { username: string; display_name: string; avatar_url: string | null } | null;
}

/**
 * Searches the viewer's own messages, which no mainstream app lets you do.
 *
 * No viewer filter is applied here on purpose: the messages SELECT policy
 * already scopes rows to conversations the caller belongs to, so adding a
 * client-side filter would either duplicate that rule or contradict it.
 */
export async function searchMessages(
  parsed: ParsedSearch,
  limit = 40,
): Promise<MessageHit[]> {
  if (!parsed.text) return [];

  let q = supabase
    .from("messages")
    .select(
      `id, conversation_id, content, created_at,
       sender:profiles!messages_sender_id_fkey (username, display_name, avatar_url)`,
    )
    .eq("is_deleted", false)
    .ilike("content", `%${parsed.text}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (parsed.after) q = q.gte("created_at", parsed.after);
  if (parsed.before) q = q.lte("created_at", parsed.before);
  for (const word of parsed.exclude) q = q.not("content", "ilike", `%${word}%`);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as MessageHit[];
}

/** Searches inside what the viewer saved, including their own notes. */
export async function searchSaved(
  userId: string,
  parsed: ParsedSearch,
  limit = 40,
): Promise<Post[]> {
  const { data: rows, error } = await supabase
    .from("bookmarks")
    .select("post_id, note")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const posts = await getPostsByIds(rows.map((r) => r.post_id));
  const needle = parsed.text.toLowerCase();
  return rows
    .map((row) => ({ post: posts.get(row.post_id), note: row.note }))
    .filter(({ post, note }) => {
      if (!post || post.is_hidden) return false;
      if (!needle) return true;
      // The note is the viewer's own words about why they kept it, which is
      // often the only thing they remember a year later.
      return (
        post.content?.toLowerCase().includes(needle) ||
        note?.toLowerCase().includes(needle)
      );
    })
    .slice(0, limit)
    .map(({ post }) => post!) as Post[];
}

/** Searches the posts the viewer liked. */
export async function searchLiked(
  userId: string,
  parsed: ParsedSearch,
  limit = 40,
): Promise<Post[]> {
  const { data: rows, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const posts = await getPostsByIds(rows.map((r) => r.post_id));
  const needle = parsed.text.toLowerCase();
  return rows
    .map((row) => posts.get(row.post_id))
    .filter(
      (post): post is Post =>
        !!post &&
        !post.is_hidden &&
        (!needle || !!post.content?.toLowerCase().includes(needle)),
    )
    .slice(0, limit);
}

export interface SavedPostSearch {
  id: string;
  query: string;
  label: string | null;
  alerts_enabled: boolean;
  created_at: string;
}

/**
 * Saved post searches. Scoped so Marketplace's own saved searches, which
 * live in the same table and predate this, stay out of the way.
 */
export async function getSavedPostSearches(userId: string) {
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, query, label, alerts_enabled, created_at")
    .eq("user_id", userId)
    .eq("scope", "posts")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedPostSearch[];
}

export async function savePostSearch(
  userId: string,
  query: string,
  options: { label?: string; alerts?: boolean } = {},
) {
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      user_id: userId,
      query,
      scope: "posts",
      label: options.label?.trim() || null,
      alerts_enabled: options.alerts ?? false,
    })
    .select("id, query, label, alerts_enabled, created_at")
    .single();
  if (error) throw error;
  return data as SavedPostSearch;
}

/**
 * Turns alerts on or off for one saved search. Enabling also resets the
 * watermark, so switching alerts on never delivers a backlog of everything
 * that matched while they were off.
 */
export async function setSavedSearchAlerts(searchId: string, enabled: boolean) {
  const { error } = await supabase
    .from("saved_searches")
    .update({
      alerts_enabled: enabled,
      ...(enabled ? { last_alerted_at: new Date().toISOString() } : {}),
    })
    .eq("id", searchId);
  if (error) throw error;
}

export async function deleteSavedPostSearch(searchId: string) {
  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", searchId);
  if (error) throw error;
}
