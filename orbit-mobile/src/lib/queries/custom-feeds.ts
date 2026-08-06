import { supabase } from "@/lib/supabase";
import { getPostsByIds, type Post } from "@/lib/queries/posts";

export interface CustomFeed {
  id: string;
  name: string;
  hashtags: string[];
  keywords: string[];
  following_only: boolean;
  media_only: "image" | "video" | null;
  is_pinned: boolean;
  position: number;
  created_at: string;
}

export interface CustomFeedInput {
  name: string;
  hashtags: string[];
  keywords: string[];
  followingOnly: boolean;
  mediaOnly: "image" | "video" | null;
}

/** Tags are stored lowercase and without the #, so matching is predictable. */
function normalizeTags(tags: string[]): string[] {
  return tags
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
    .filter((tag) => tag.length > 0);
}

function normalizeKeywords(keywords: string[]): string[] {
  return keywords.map((word) => word.trim()).filter((word) => word.length > 0);
}

export async function getCustomFeeds(userId: string): Promise<CustomFeed[]> {
  const { data, error } = await supabase
    .from("custom_feeds")
    .select("*")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CustomFeed[];
}

export async function createCustomFeed(
  userId: string,
  input: CustomFeedInput,
): Promise<CustomFeed> {
  const { data, error } = await supabase
    .from("custom_feeds")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      hashtags: normalizeTags(input.hashtags),
      keywords: normalizeKeywords(input.keywords),
      following_only: input.followingOnly,
      media_only: input.mediaOnly,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CustomFeed;
}

export async function updateCustomFeed(
  feedId: string,
  input: CustomFeedInput,
): Promise<void> {
  const { error } = await supabase
    .from("custom_feeds")
    .update({
      name: input.name.trim(),
      hashtags: normalizeTags(input.hashtags),
      keywords: normalizeKeywords(input.keywords),
      following_only: input.followingOnly,
      media_only: input.mediaOnly,
    })
    .eq("id", feedId);
  if (error) throw error;
}

export async function deleteCustomFeed(feedId: string): Promise<void> {
  const { error } = await supabase.from("custom_feeds").delete().eq("id", feedId);
  if (error) throw error;
}

export async function setCustomFeedPinned(feedId: string, pinned: boolean) {
  const { error } = await supabase
    .from("custom_feeds")
    .update({ is_pinned: pinned })
    .eq("id", feedId);
  if (error) throw error;
}

/**
 * One page of a custom feed, newest first.
 *
 * The RPC returns bare `posts` rows, so the author and media are hydrated
 * through getPostsByIds the same way the ranked feed does, and the RPC's
 * order is restored afterwards because that lookup has its own.
 */
export async function getCustomFeedPage(
  feedId: string,
  before?: string,
  limit = 20,
): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const { data, error } = await supabase.rpc("custom_feed_posts", {
    p_feed_id: feedId,
    p_limit: limit,
    p_before: before ?? null,
  });
  if (error) throw error;

  const rows = (data ?? []) as { id: string; created_at: string }[];
  if (rows.length === 0) return { posts: [], nextCursor: null };

  const byId = await getPostsByIds(rows.map((row) => row.id));
  const posts = rows
    .map((row) => byId.get(row.id))
    .filter((post): post is Post => !!post);

  return {
    posts,
    // A short page means the feed is exhausted, so pagination stops rather
    // than asking again for the same tail forever.
    nextCursor:
      rows.length < limit ? null : rows[rows.length - 1].created_at,
  };
}
