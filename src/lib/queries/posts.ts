import { createClient } from "@/lib/supabase/client";
import type { PostFormData } from "@/lib/utils/validators";

const supabase = createClient();

export interface PostWithAuthor {
  id: string;
  user_id: string;
  content: string | null;
  type: "text" | "image" | "video" | "reel" | "poll" | "repost" | "quote";
  parent_post_id: string | null;
  reply_to_id: string | null;
  community_id: string | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  view_count: number;
  bookmark_count: number;
  poll_data: PollData | null;
  is_pinned: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  post_media: MediaItem[];
  user_has_liked?: boolean;
  user_has_bookmarked?: boolean;
  user_has_reposted?: boolean;
  quoted_post?: PostWithAuthor | null;
}

export interface MediaItem {
  id: string;
  type: "image" | "video" | "gif";
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  sort_order: number;
}

export interface PollData {
  options: { text: string; votes: number }[];
  ends_at: string;
  multi_select: boolean;
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

export async function createPost(
  userId: string,
  data: PostFormData,
  mediaUrls: { url: string; type: "image" | "video" | "gif" }[] = [],
  options?: {
    replyToId?: string;
    parentPostId?: string;
    type?: PostWithAuthor["type"];
    pollData?: PollData;
  }
) {
  const postType =
    options?.type ||
    (mediaUrls.length > 0
      ? mediaUrls[0].type === "video"
        ? "video"
        : "image"
      : options?.pollData
        ? "poll"
        : "text");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content: data.content,
      type: postType,
      reply_to_id: options?.replyToId || null,
      parent_post_id: options?.parentPostId || null,
      poll_data: options?.pollData || null,
    })
    .select(POST_SELECT)
    .single();

  if (error) throw error;

  // Insert media if any
  if (mediaUrls.length > 0 && post) {
    const mediaInserts = mediaUrls.map((m, i) => ({
      post_id: post.id,
      type: m.type,
      url: m.url,
      sort_order: i,
    }));

    const { error: mediaError } = await supabase
      .from("post_media")
      .insert(mediaInserts);

    if (mediaError) throw mediaError;
  }

  // Extract and insert hashtags
  if (data.content) {
    const tags = data.content.match(/#(\w+)/g);
    if (tags) {
      for (const tag of tags) {
        const name = tag.slice(1).toLowerCase();
        const { data: hashtag } = await supabase
          .from("hashtags")
          .upsert({ name }, { onConflict: "name" })
          .select("id")
          .single();

        if (hashtag) {
          await supabase
            .from("post_hashtags")
            .insert({ post_id: post.id, hashtag_id: hashtag.id })
            .select();
        }
      }
    }
  }

  return post;
}

export async function getFeedPosts(
  userId: string,
  tab: "foryou" | "following",
  cursor?: string,
  limit = 20
) {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .is("reply_to_id", null)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  if (tab === "following") {
    // Get user's following list first
    const { data: following } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);

    const followingIds = following?.map((f) => f.following_id) || [];
    followingIds.push(userId); // Include own posts

    if (followingIds.length > 0) {
      query = query.in("user_id", followingIds);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as PostWithAuthor[];
}

export async function getPostById(postId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .single();

  if (error) throw error;
  return data as PostWithAuthor;
}

export async function getPostComments(postId: string, cursor?: string, limit = 20) {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("reply_to_id", postId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (cursor) {
    query = query.gt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as PostWithAuthor[];
}

export async function getUserPosts(userId: string, cursor?: string, limit = 20) {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .is("reply_to_id", null)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as PostWithAuthor[];
}

export async function toggleLike(userId: string, postId: string, isLiked: boolean) {
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

export async function toggleBookmark(userId: string, postId: string, isBookmarked: boolean) {
  if (isBookmarked) {
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("post_id", postId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("bookmarks")
      .insert({ user_id: userId, post_id: postId });
    if (error) throw error;
  }
}

export async function deletePost(postId: string) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function checkUserInteractions(userId: string, postIds: string[]) {
  const [likesResult, bookmarksResult] = await Promise.all([
    supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
    supabase
      .from("bookmarks")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
  ]);

  const likedPostIds = new Set(likesResult.data?.map((l) => l.post_id));
  const bookmarkedPostIds = new Set(bookmarksResult.data?.map((b) => b.post_id));

  return { likedPostIds, bookmarkedPostIds };
}

export async function uploadPostMedia(
  userId: string,
  file: File
): Promise<{ url: string; type: "image" | "video" | "gif" }> {
  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("post-media")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("post-media").getPublicUrl(filePath);

  const type = file.type.startsWith("video/")
    ? "video"
    : file.type === "image/gif"
      ? "gif"
      : "image";

  return { url: publicUrl, type };
}
