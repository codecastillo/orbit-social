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
  view_count: number;
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
}

export const CLIP_PAGE_SIZE = 10;

const CLIP_SELECT = `
  *,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  post_media (
    id, type, url, thumbnail_url, width, height, blurhash, sort_order
  )
`;

export async function getClips(
  userId: string,
  cursor?: string,
  limit = CLIP_PAGE_SIZE,
): Promise<ClipWithAuthor[]> {
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

  // Through unknown: the literal-type query parser infers the to-one
  // profiles join as an array without generated DB types.
  const clips = (data ?? []) as unknown as ClipWithAuthor[];
  if (clips.length === 0) return [];

  const ids = clips.map((c) => c.id);
  const [{ data: likes }, { data: bookmarks }] = await Promise.all([
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
  ]);

  const likedIds = new Set((likes ?? []).map((l) => l.post_id));
  const bookmarkedIds = new Set((bookmarks ?? []).map((b) => b.post_id));
  for (const clip of clips) {
    clip.user_has_liked = likedIds.has(clip.id);
    clip.user_has_bookmarked = bookmarkedIds.has(clip.id);
  }

  return clips;
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
