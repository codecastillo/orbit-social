import { supabase } from "@/lib/supabase";

export interface ClipMedia {
  id: string;
  type: "image" | "video" | "gif";
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  sort_order: number;
  duration_ms: number | null;
}

export interface ClipWithAuthor {
  id: string;
  user_id: string;
  content: string | null;
  type: string;
  like_count: number;
  comment_count: number;
  bookmark_count: number;
  share_count: number | null;
  repost_count: number;
  view_count: number;
  loop_count: number;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  post_media: ClipMedia[];
  user_has_liked: boolean;
  user_has_bookmarked: boolean;
  user_has_reposted: boolean;
}

export const CLIP_PAGE_SIZE = 10;

export type ClipLane = "all" | "loops";

/** A clip qualifies for the Loops lane when its video runs 8 seconds or less. */
export const LOOP_MAX_DURATION_MS = 8000;

const CLIP_MEDIA_COLUMNS =
  "id, type, url, thumbnail_url, width, height, blurhash, sort_order, duration_ms";

const CLIP_SELECT = `
  *,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  post_media (${CLIP_MEDIA_COLUMNS})
`;

// Loops lane: !inner turns the embed into an inner join so the lte filter on
// post_media.duration_ms drops posts without a short-enough video. Side
// effect of the embed filter: post_media only carries the matching rows,
// which is fine because clips are single-video posts.
const LOOP_CLIP_SELECT = `
  *,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  post_media!inner (${CLIP_MEDIA_COLUMNS})
`;

/** Marks each clip with whether the viewer liked, bookmarked, or looped it. */
async function attachViewerState(
  clips: ClipWithAuthor[],
  userId: string,
): Promise<ClipWithAuthor[]> {
  if (clips.length === 0) return clips;

  const ids = clips.map((c) => c.id);
  const [{ data: likes }, { data: bookmarks }, { data: reposts }] =
    await Promise.all([
      supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", ids),
      supabase
        .from("bookmarks")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", ids),
      supabase
        .from("posts")
        .select("parent_post_id")
        .eq("user_id", userId)
        .eq("type", "repost")
        .in("parent_post_id", ids),
    ]);

  const likedIds = new Set((likes ?? []).map((l) => l.post_id));
  const bookmarkedIds = new Set((bookmarks ?? []).map((b) => b.post_id));
  const repostedIds = new Set((reposts ?? []).map((r) => r.parent_post_id));
  for (const clip of clips) {
    clip.user_has_liked = likedIds.has(clip.id);
    clip.user_has_bookmarked = bookmarkedIds.has(clip.id);
    clip.user_has_reposted = repostedIds.has(clip.id);
  }

  return clips;
}

export async function getClips(
  userId: string,
  cursor?: string,
  lane: ClipLane = "all",
  limit = CLIP_PAGE_SIZE,
): Promise<ClipWithAuthor[]> {
  // Widened to string so both lanes flow through one filter chain; the result
  // is cast below anyway because there are no generated DB types.
  const select: string = lane === "loops" ? LOOP_CLIP_SELECT : CLIP_SELECT;

  let query = supabase
    .from("posts")
    .select(select)
    .eq("type", "reel")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (lane === "loops") {
    query = query.lte("post_media.duration_ms", LOOP_MAX_DURATION_MS);
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Through unknown: the literal-type query parser infers the to-one
  // profiles join as an array without generated DB types.
  const clips = (data ?? []) as unknown as ClipWithAuthor[];
  return attachViewerState(clips, userId);
}

/** Monday of the ISO week containing the given date, as YYYY-MM-DD (UTC). */
function isoWeekMonday(date: Date): string {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const daysSinceMonday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - daysSinceMonday);
  return utc.toISOString().slice(0, 10);
}

/**
 * This week's hand-curated Best Loops, falling back to the most recent
 * curated week so the shelf never sits empty just because the current
 * week's picks are not in yet. Returns [] on any failure: Best Loops is an
 * optional shelf and must never take the feed down with it.
 */
export async function getCuratedClips(
  userId: string,
): Promise<ClipWithAuthor[]> {
  try {
    const currentWeek = await supabase
      .from("curated_clips")
      .select("post_id, sort_order")
      .eq("week_start", isoWeekMonday(new Date()))
      .order("sort_order");
    if (currentWeek.error) throw currentWeek.error;
    let rows = currentWeek.data;

    if (!rows || rows.length === 0) {
      const { data: latest, error: latestError } = await supabase
        .from("curated_clips")
        .select("week_start")
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;
      if (!latest) return [];

      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("curated_clips")
        .select("post_id, sort_order")
        .eq("week_start", latest.week_start)
        .order("sort_order");
      if (fallbackError) throw fallbackError;
      rows = fallbackRows;
    }
    if (!rows || rows.length === 0) return [];

    const curatedOrder = new Map(rows.map((r, index) => [r.post_id, index]));
    const { data, error: postsError } = await supabase
      .from("posts")
      .select(CLIP_SELECT)
      .in(
        "id",
        rows.map((r) => r.post_id),
      )
      .eq("type", "reel")
      .eq("is_hidden", false);
    if (postsError) throw postsError;

    const clips = (data ?? []) as unknown as ClipWithAuthor[];
    clips.sort(
      (a, b) => (curatedOrder.get(a.id) ?? 0) - (curatedOrder.get(b.id) ?? 0),
    );
    return await attachViewerState(clips, userId);
  } catch {
    return [];
  }
}

/** Flushes a locally accumulated batch of loop completions to the server. */
export async function incrementClipLoops(postId: string, loops: number) {
  const { error } = await supabase.rpc("increment_clip_loops", {
    p_post_id: postId,
    p_loops: loops,
  });
  if (error) throw error;
}

export async function recordClipShare(postId: string) {
  const { error } = await supabase.rpc("increment_post_shares", {
    p_post_id: postId,
  });
  if (error) throw error;
}

export async function toggleClipLike(
  userId: string,
  postId: string,
  isLiked: boolean,
) {
  if (isLiked) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("user_id", userId)
      .eq("post_id", postId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("post_likes")
      .insert({ user_id: userId, post_id: postId });
    if (error) throw error;
  }
}
