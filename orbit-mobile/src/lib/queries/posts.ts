import { supabase } from "@/lib/supabase";
import {
  getPostsReactionCounts,
  getUserReactions,
  type ReactionCount,
  type ReactionType,
} from "@/lib/queries/reactions";

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
  parent_post_id: string | null;
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
  id, user_id, content, type, parent_post_id, reply_to_id, community_id,
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

export type FeedTab = "foryou" | "following";

// Bounded like the web getFeedPosts: past this the Following tab needs a
// server-side join instead of an IN list.
const FOLLOWING_IDS_LIMIT = 1000;

// Mobile still skips close-friends resolution (public posts plus the
// viewer's own), but now includes reposts and quotes; the card resolves
// their originals per page. Reels stay in the clips tab.
export async function getFeedPosts(userId: string, tab: FeedTab, cursor?: string) {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .is("reply_to_id", null)
    .is("community_id", null)
    .eq("is_hidden", false)
    .not("type", "eq", "reel")
    .or(`visibility.eq.public,user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  if (tab === "following") {
    const { data: following, error: followsError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .limit(FOLLOWING_IDS_LIMIT);
    if (followsError) throw followsError;

    // Only people you follow; your own posts stay on For you.
    const followingIds = following?.map((f) => f.following_id) ?? [];
    if (followingIds.length === 0) return [];
    query = query.in("user_id", followingIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as Post[];
}

export async function getPostsByIds(postIds: string[]): Promise<Map<string, Post>> {
  if (postIds.length === 0) return new Map();

  const { data, error } = await supabase.from("posts").select(POST_SELECT).in("id", postIds);

  if (error) throw error;
  return new Map(((data ?? []) as unknown as Post[]).map((p) => [p.id, p]));
}

export interface FeedPage {
  posts: Post[];
  // Resolved parents for repost and quote rows, keyed by original post id.
  originals: Map<string, Post>;
  // Reaction tallies keyed by the id each card displays (the original for
  // repost rows), fetched once per page instead of per card.
  reactionCounts: Map<string, ReactionCount[]>;
}

// A repost row displays and acts on its original post; every other row
// (including quotes, whose embedded card is secondary) acts on itself.
export function displayPostId(post: Post): string {
  return post.type === "repost" && post.parent_post_id ? post.parent_post_id : post.id;
}

export async function getFeedPage(
  userId: string,
  tab: FeedTab,
  cursor?: string,
): Promise<FeedPage> {
  const posts = await getFeedPosts(userId, tab, cursor);

  const parentIds = [
    ...new Set(
      posts
        .filter((p) => (p.type === "repost" || p.type === "quote") && p.parent_post_id)
        .map((p) => p.parent_post_id as string),
    ),
  ];

  const originals = await getPostsByIds(parentIds);
  const reactionCounts = await getPostsReactionCounts([
    ...new Set(posts.map((p) => displayPostId(p))),
  ]);

  return { posts, originals, reactionCounts };
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

// Web createRepost/undoRepost equivalents. The count bump goes through a
// SECURITY DEFINER RPC because a direct UPDATE on someone else's post is
// silently blocked by RLS, leaving the count stuck.
export async function createRepost(userId: string, postId: string) {
  const { data: existing } = await supabase
    .from("posts")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "repost")
    .eq("parent_post_id", postId)
    .maybeSingle();

  if (existing) throw new Error("Already reposted");

  const { error } = await supabase.from("posts").insert({
    user_id: userId,
    content: null,
    type: "repost",
    parent_post_id: postId,
  });
  if (error) throw error;

  const { error: rpcError } = await supabase.rpc("increment_post_reposts", {
    p_post_id: postId,
  });
  if (rpcError) console.error("increment_post_reposts failed", rpcError);
}

export async function undoRepost(userId: string, postId: string) {
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("user_id", userId)
    .eq("type", "repost")
    .eq("parent_post_id", postId);

  if (error) throw error;

  const { error: rpcError } = await supabase.rpc("decrement_post_reposts", {
    p_post_id: postId,
  });
  if (rpcError) console.error("decrement_post_reposts failed", rpcError);
}

export interface UserInteractions {
  likedPostIds: Set<string>;
  bookmarkedPostIds: Set<string>;
  repostedPostIds: Set<string>;
  reactions: Map<string, ReactionType>;
}

export async function checkUserInteractions(
  userId: string,
  postIds: string[],
): Promise<UserInteractions> {
  if (postIds.length === 0) {
    return {
      likedPostIds: new Set(),
      bookmarkedPostIds: new Set(),
      repostedPostIds: new Set(),
      reactions: new Map(),
    };
  }

  const [likesResult, bookmarksResult, repostsResult, reactions] = await Promise.all([
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
    supabase
      .from("posts")
      .select("parent_post_id")
      .eq("user_id", userId)
      .eq("type", "repost")
      .in("parent_post_id", postIds),
    getUserReactions(userId, postIds),
  ]);

  if (likesResult.error) throw likesResult.error;
  if (bookmarksResult.error) throw bookmarksResult.error;
  if (repostsResult.error) throw repostsResult.error;

  return {
    likedPostIds: new Set(likesResult.data.map((l) => l.post_id)),
    bookmarkedPostIds: new Set(bookmarksResult.data.map((b) => b.post_id)),
    repostedPostIds: new Set(
      repostsResult.data.map((r) => r.parent_post_id as string).filter(Boolean),
    ),
    reactions,
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
