import { createClient } from "@/lib/supabase/client";
import type { PostWithAuthor } from "@/lib/queries/posts";

const supabase = createClient();

const CLIP_SELECT = `
  *,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  post_media (
    id, type, url, thumbnail_url, width, height, blurhash, sort_order
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
  thumbnailUrl?: string
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
