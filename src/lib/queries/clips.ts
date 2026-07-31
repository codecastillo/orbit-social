import { createClient } from "@/lib/supabase/client";
import type { PostWithAuthor } from "@/lib/queries/posts";

const supabase = createClient();

// `*` covers the posts columns (including loop_count); the joins list
// their columns explicitly because nested `*` drags in heavy relations.
const CLIP_SELECT = `
  *,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  post_media (
    id, type, url, thumbnail_url, width, height, blurhash, sort_order,
    duration_ms
  )
`;

export async function getClips(cursor?: string, limit = 10) {
  let query = supabase
    .from("posts")
    .select(CLIP_SELECT)
    .eq("type", "reel")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as PostWithAuthor[];
}

export async function getClipById(clipId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(CLIP_SELECT)
    .eq("id", clipId)
    .eq("type", "reel")
    .single();

  if (error) throw error;
  return data as unknown as PostWithAuthor;
}

export async function createClip(
  userId: string,
  content: string,
  videoUrl: string,
  thumbnailUrl?: string,
  durationMs?: number | null
) {
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content,
      type: "reel",
    })
    .select(CLIP_SELECT)
    .single();

  if (error) throw error;

  const { error: mediaError } = await supabase.from("post_media").insert({
    post_id: post.id,
    type: "video",
    url: videoUrl,
    thumbnail_url: thumbnailUrl || null,
    duration_ms: durationMs ?? null,
    sort_order: 0,
  });

  if (mediaError) throw mediaError;

  return post as PostWithAuthor;
}

export async function uploadClipVideo(
  userId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("post-media")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("post-media").getPublicUrl(filePath);

  return publicUrl;
}

// ── Loop counting ────────────────────────────────────────────────────

/**
 * Flushes a batch of locally accumulated playback loops. Fire-and-forget:
 * the player calls this on a debounce and on unmount, and losing a batch
 * to a network blip is fine, the count is directional, not billing.
 */
export function flushClipLoops(postId: string, loops: number) {
  if (loops <= 0) return;
  supabase
    .rpc("increment_clip_loops", { p_post_id: postId, p_loops: loops })
    .then(({ error }) => {
      if (error) console.error("increment_clip_loops failed", error);
    });
}

// ── Best Loops (weekly hand-curated clips) ───────────────────────────

export interface CuratedClip {
  week_start: string;
  sort_order: number;
  post: PostWithAuthor;
}

interface CuratedRow {
  week_start: string;
  sort_order: number;
  posts: PostWithAuthor | null;
}

const CURATED_SELECT = `
  week_start, sort_order,
  posts:post_id ( ${CLIP_SELECT} )
`;

/** Monday of the ISO week containing `d`, as a YYYY-MM-DD date string. */
export function isoWeekMonday(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // Sunday counts as 7
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

async function fetchCuratedWeek(weekStart: string): Promise<CuratedClip[]> {
  const { data, error } = await supabase
    .from("curated_clips")
    .select(CURATED_SELECT)
    .eq("week_start", weekStart)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as CuratedRow[])
    .filter((r): r is CuratedRow & { posts: PostWithAuthor } =>
      r.posts !== null && !r.posts.is_hidden
    )
    .map((r) => ({
      week_start: r.week_start,
      sort_order: r.sort_order,
      post: r.posts,
    }));
}

/**
 * Curated Best Loops for the given week (default: current ISO week),
 * falling back to the most recent week that has rows so the shelf does
 * not vanish every Monday before curation happens. Returns [] on any
 * error so the clips feed simply degrades to the plain feed.
 */
export async function getCuratedClips(
  weekStart?: string
): Promise<PostWithAuthor[]> {
  try {
    const week = weekStart ?? isoWeekMonday();
    let rows = await fetchCuratedWeek(week);
    if (rows.length === 0) {
      const { data, error } = await supabase
        .from("curated_clips")
        .select("week_start")
        .lt("week_start", week)
        .order("week_start", { ascending: false })
        .limit(1);
      if (error) throw error;
      const latest = data?.[0]?.week_start;
      if (latest) rows = await fetchCuratedWeek(latest);
    }
    return rows.map((r) => r.post);
  } catch (error) {
    console.error("getCuratedClips failed", error);
    return [];
  }
}

// ── Admin curation ───────────────────────────────────────────────────
// Writes run under the admin's own JWT; RLS on curated_clips checks
// profiles.is_admin (20260731240000_curated_clips.sql).

/** Exact week only, no fallback: the admin page edits one week at a time. */
export async function getCuratedWeekAdmin(weekStart: string) {
  return fetchCuratedWeek(weekStart);
}

export async function addCuratedClip(
  weekStart: string,
  postId: string,
  sortOrder: number
) {
  const { error } = await supabase.from("curated_clips").insert({
    week_start: weekStart,
    post_id: postId,
    sort_order: sortOrder,
  });
  if (error) throw error;
}

export async function removeCuratedClip(weekStart: string, postId: string) {
  const { error } = await supabase
    .from("curated_clips")
    .delete()
    .eq("week_start", weekStart)
    .eq("post_id", postId);
  if (error) throw error;
}

/** Persists a full clip ordering after an up/down move. */
export async function reorderCuratedClips(
  weekStart: string,
  postIds: string[]
) {
  await Promise.all(
    postIds.map(async (postId, index) => {
      const { error } = await supabase
        .from("curated_clips")
        .update({ sort_order: index })
        .eq("week_start", weekStart)
        .eq("post_id", postId);
      if (error) throw error;
    })
  );
}

/** Caption search restricted to reels, for the admin curation picker. */
export async function searchReels(query: string, limit = 8) {
  const { data, error } = await supabase
    .from("posts")
    .select(CLIP_SELECT)
    .eq("type", "reel")
    .eq("is_hidden", false)
    .ilike("content", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as PostWithAuthor[];
}
