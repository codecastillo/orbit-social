import { supabase } from "@/lib/supabase";

export interface PostAuthor {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
}

export interface PostMediaItem {
  id: string;
  type: "image" | "video" | "gif";
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  sort_order: number;
}

export interface Post {
  id: string;
  user_id: string;
  content: string | null;
  type: "text" | "image" | "video" | "reel" | "poll" | "repost" | "quote";
  reply_to_id: string | null;
  community_id: string | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  bookmark_count: number;
  is_hidden: boolean;
  visibility: "public" | "close_friends";
  created_at: string;
  profiles: PostAuthor;
  post_media: PostMediaItem[];
}

// Mirrors the web app's POST_SELECT, trimmed to the columns the mobile
// screens render. The cast goes through unknown because without generated
// DB types the query parser infers the to-one profiles join as an array.
const POST_SELECT = `
  id, user_id, content, type, reply_to_id, community_id,
  like_count, comment_count, repost_count, bookmark_count,
  is_hidden, visibility, created_at,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  post_media (
    id, type, url, thumbnail_url, width, height, blurhash, sort_order
  )
`;

export const FEED_PAGE_SIZE = 20;

// v1 feed skips close-friends resolution: public posts plus the viewer's
// own, newest first. Reels and reposts are excluded like the web public
// timeline (reels live in the clips tab, reposts need quoted-post
// rendering the mobile card does not have yet).
export async function getFeedPosts(userId: string, cursor?: string) {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .is("reply_to_id", null)
    .is("community_id", null)
    .eq("is_hidden", false)
    .not("type", "in", "(reel,repost)")
    .or(`visibility.eq.public,user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as Post[];
}

export async function getPost(postId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .single();

  if (error) throw error;
  return data as unknown as Post;
}

export async function getReplies(postId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("reply_to_id", postId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as unknown as Post[];
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

export interface UserInteractions {
  likedPostIds: Set<string>;
  bookmarkedPostIds: Set<string>;
}

export async function checkUserInteractions(
  userId: string,
  postIds: string[],
): Promise<UserInteractions> {
  if (postIds.length === 0) {
    return { likedPostIds: new Set(), bookmarkedPostIds: new Set() };
  }

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

  if (likesResult.error) throw likesResult.error;
  if (bookmarksResult.error) throw bookmarksResult.error;

  return {
    likedPostIds: new Set(likesResult.data.map((l) => l.post_id)),
    bookmarkedPostIds: new Set(bookmarksResult.data.map((b) => b.post_id)),
  };
}

export interface NewPostMedia {
  url: string;
  type: "image" | "video" | "gif";
  width: number | null;
  height: number | null;
}

// Same insert shape the web createPost uses; the mobile composer only
// needs text and image posts, plus replies from the detail screen.
export async function createPost(
  userId: string,
  content: string,
  options?: { replyToId?: string; media?: NewPostMedia[] },
) {
  const media = options?.media ?? [];

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content,
      type: media.length > 0 ? "image" : "text",
      reply_to_id: options?.replyToId || null,
      visibility: "public",
    })
    .select(POST_SELECT)
    .single();

  if (error) throw error;

  if (media.length > 0 && post) {
    const { error: mediaError } = await supabase.from("post_media").insert(
      media.map((m, i) => ({
        post_id: post.id,
        type: m.type,
        url: m.url,
        width: m.width,
        height: m.height,
        sort_order: i,
      })),
    );
    if (mediaError) throw mediaError;
  }

  return post as unknown as Post;
}

// Uploads into the same "post-media" bucket the web app uses, with the
// same {userId}/{timestamp}_{random}.{ext} path convention.
export async function uploadPostMedia(
  userId: string,
  uri: string,
  mimeType: string,
): Promise<string> {
  const ext = mimeType.split("/")[1] ?? "jpg";
  const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const response = await fetch(uri);
  const body = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from("post-media")
    .upload(filePath, body, { contentType: mimeType });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("post-media").getPublicUrl(filePath);
  return publicUrl;
}
