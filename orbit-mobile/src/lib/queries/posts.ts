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
  // Author-size signals for feed ranking (cold-start detection).
  follower_count?: number;
  post_count?: number;
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
  view_count: number;
  is_hidden: boolean;
  // Profile pin on top-level posts, author pin on comments (reply_to_id set).
  is_pinned: boolean;
  visibility: "public" | "close_friends";
  boosted_until?: string | null;
  created_at: string;
  profiles: PostAuthor;
  post_media: PostMediaItem[];
}

// Mirrors the web app's POST_SELECT, trimmed to the columns the mobile
// screens render. The cast goes through unknown because without generated
// DB types the query parser infers the to-one profiles join as an array.
const POST_SELECT = `
  id, user_id, content, type, parent_post_id, reply_to_id, community_id,
  like_count, comment_count, repost_count, bookmark_count, view_count,
  is_hidden, is_pinned, visibility, boosted_until, created_at,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified,
    follower_count, post_count
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

// Includes reposts and quotes; the card resolves their originals per
// page. Reels stay in the clips tab. Close-friends visibility resolves
// after the fetch, same as the web getFeedPosts.
export async function getFeedPosts(userId: string, tab: FeedTab, cursor?: string) {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .is("reply_to_id", null)
    .is("community_id", null)
    .eq("is_hidden", false)
    .not("type", "eq", "reel")
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

  // Filter close_friends posts: only show if the viewer is in the poster's
  // close_friends list, mirroring the web getFeedPosts.
  const posts = data as unknown as Post[];
  const closeFriendsPosts = posts.filter(
    (p) => p.visibility === "close_friends" && p.user_id !== userId,
  );

  if (closeFriendsPosts.length > 0) {
    const posterIds = [...new Set(closeFriendsPosts.map((p) => p.user_id))];
    const { data: cfData } = await supabase
      .from("close_friends")
      .select("user_id")
      .in("user_id", posterIds)
      .eq("friend_id", userId);

    const allowedPosterIds = new Set((cfData ?? []).map((cf) => cf.user_id));

    return posts.filter((p) => {
      if (p.visibility !== "close_friends") return true;
      if (p.user_id === userId) return true;
      return allowedPosterIds.has(p.user_id);
    });
  }

  return posts;
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
  // Chronological cursor captured before For You ranking reorders the
  // page, so pagination stays a clean created_at walk. Null on the last
  // page.
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// For You ranking. Mirrors the web scorePost in
// src/lib/services/feed-algorithm.ts (mobile cannot import web code): a
// dominant recency decay, log-dampened engagement, a media bonus, an
// additive boost while boosted_until is in the future, and an additive
// cold-start bonus so small authors' first posts are guaranteed
// distribution. Applied per fetched page only; already-delivered pages are
// never re-ranked, so nothing reorders under the user's thumb.
// ---------------------------------------------------------------------------

const RECENCY_HALF_LIFE_HOURS = 12;
const ENGAGEMENT_SATURATION = 500;
const BOOST_BONUS = 0.35;
const COLD_START_WINDOW_HOURS = 48;
const COLD_START_FOLLOWER_CEILING = 100;
const COLD_START_POST_CEILING = 5;
const COLD_START_MAX_BONUS = 0.3;

function scorePost(post: Post): number {
  const ageHours = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
  const recency = Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);

  const weighted = post.like_count + post.comment_count * 2 + post.repost_count * 3;
  const engagement = Math.min(Math.log1p(weighted) / Math.log1p(ENGAGEMENT_SATURATION), 1.0);

  const media =
    post.post_media.length === 0
      ? 0
      : post.post_media.some((m) => m.type === "video")
        ? 0.15
        : 0.1;

  const boosted =
    post.boosted_until && new Date(post.boosted_until) > new Date() ? BOOST_BONUS : 0;

  let coldStart = 0;
  if (ageHours < COLD_START_WINDOW_HOURS) {
    const followers = post.profiles?.follower_count ?? 0;
    const authored = post.profiles?.post_count ?? 0;
    if (followers < COLD_START_FOLLOWER_CEILING || authored <= COLD_START_POST_CEILING) {
      coldStart = COLD_START_MAX_BONUS * (1 - ageHours / COLD_START_WINDOW_HOURS);
    }
  }

  return recency * 0.5 + engagement * 0.2 + media * 0.05 + boosted + coldStart;
}

function rankPage(posts: Post[]): Post[] {
  if (posts.length <= 1) return posts;
  return posts
    .map((post) => ({ post, score: scorePost(post) }))
    // created_at desc breaks score ties so re-renders never shuffle.
    .sort(
      (a, b) => b.score - a.score || b.post.created_at.localeCompare(a.post.created_at),
    )
    .map((s) => s.post);
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
  const fetched = await getFeedPosts(userId, tab, cursor);

  // Same page-exhaustion rule the screen used before ranking landed: a
  // short page means the walk is done.
  const nextCursor =
    fetched.length < FEED_PAGE_SIZE ? null : fetched[fetched.length - 1].created_at;

  // For You ranks within the fetched window; Following stays strictly
  // chronological and complete.
  const posts = tab === "foryou" ? rankPage(fetched) : fetched;

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

  return { posts, originals, reactionCounts, nextCursor };
}

// Null when the post does not exist or RLS hides it (a close-friends post
// the viewer is not allowed to see looks identical to a missing row).
export async function getPost(postId: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Post | null;
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

// SECURITY DEFINER RPC: only the parent post's author may pin, and pinning
// clears any previously pinned sibling server-side.
export async function pinComment(commentId: string, pinned: boolean) {
  const { error } = await supabase.rpc("pin_comment", {
    p_comment_id: commentId,
    p_pinned: pinned,
  });
  if (error) throw error;
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

export interface NewReelMedia {
  url: string;
  width: number | null;
  height: number | null;
  durationMs: number;
}

// Reel equivalent of createPost. The web composer forces type "reel" on a
// single video destined for clips; the clip camera captures that shape
// directly. duration_ms on post_media feeds the clips Loop lane.
export async function createReelPost(userId: string, content: string, media: NewReelMedia) {
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content: content || null,
      type: "reel",
      visibility: "public",
    })
    .select("id")
    .single();

  if (error) throw error;

  const { error: mediaError } = await supabase.from("post_media").insert({
    post_id: post.id,
    type: "video",
    url: media.url,
    width: media.width,
    height: media.height,
    duration_ms: Math.round(media.durationMs),
    sort_order: 0,
  });
  if (mediaError) throw mediaError;

  return post.id as string;
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
