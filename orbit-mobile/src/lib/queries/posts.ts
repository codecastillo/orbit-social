import { supabase } from "@/lib/supabase";
import {
  getPostsReactionCounts,
  getUserReactions,
  type ReactionCount,
  type ReactionType,
} from "@/lib/queries/reactions";
import {
  getRankingSignals,
  type RankingSignals,
} from "@/lib/queries/content-safety";
import { isRankingEnabled } from "@/lib/queries/feed-ranking";

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
  duration_ms: number | null;
  alt_text: string | null;
}

// "following" means the AUTHOR's followees: only accounts the author
// follows may comment.
export type WhoCanComment = "everyone" | "following" | "nobody";

/** Postgres error text the who_can_comment BEFORE INSERT trigger raises. */
export const COMMENTS_CLOSED_ERROR = "comments_closed";

/**
 * True when a failed comment insert was rejected by that trigger rather
 * than by a network or RLS failure, so the caller can say why.
 */
export function isCommentsClosedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { message, details } = error as { message?: unknown; details?: unknown };
  return [message, details].some(
    (field) => typeof field === "string" && field.includes(COMMENTS_CLOSED_ERROR),
  );
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
  who_can_comment: WhoCanComment;
  // Optional because optimistic reply rows are built without it.
  content_warning?: string | null;
  boosted_until?: string | null;
  location?: string | null;
  poll_data: PollData | null;
  created_at: string;
  updated_at?: string | null;
  profiles: PostAuthor;
  post_media: PostMediaItem[];
}

// Mirrors the web app's POST_SELECT, trimmed to the columns the mobile
// screens render. The cast goes through unknown because without generated
// DB types the query parser infers the to-one profiles join as an array.
const POST_SELECT = `
  id, user_id, content, type, parent_post_id, reply_to_id, community_id,
  like_count, comment_count, repost_count, bookmark_count, view_count,
  is_hidden, is_pinned, visibility, who_can_comment, content_warning,
  boosted_until, location,
  poll_data, created_at, updated_at,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified,
    follower_count, post_count
  ),
  post_media (
    id, type, url, thumbnail_url, width, height, blurhash, sort_order,
    duration_ms, alt_text
  )
`;

export const FEED_PAGE_SIZE = 20;

export type FeedTab = "foryou" | "following";

// Bounded like the web getFeedPosts: past this the Following tab needs a
// server-side join instead of an IN list.
const FOLLOWING_IDS_LIMIT = 1000;

/**
 * created_at of the newest post this feed would show, or null when it is
 * empty. Selected on its own so the freshness check behind the "New posts"
 * pill costs one indexed row instead of a whole page.
 *
 * Close-friends filtering is deliberately skipped: it happens after the
 * fetch, and the worst case here is a pill that scrolls to a feed which
 * looks unchanged.
 */
export async function getNewestFeedPostAt(
  userId: string,
  tab: FeedTab,
): Promise<string | null> {
  let query = supabase
    .from("posts")
    .select("created_at")
    .is("reply_to_id", null)
    .is("community_id", null)
    .eq("is_hidden", false)
    .not("type", "eq", "reel")
    .order("created_at", { ascending: false })
    .limit(1);

  if (tab === "following") {
    const { data: following, error: followsError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .limit(FOLLOWING_IDS_LIMIT);
    if (followsError) throw followsError;

    const followingIds = following?.map((f) => f.following_id) ?? [];
    if (followingIds.length === 0) return null;
    query = query.in("user_id", followingIds);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.created_at ?? null;
}

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
    // The `following_feed(p_limit, p_cursor)` RPC does this join server-side
    // and removes the FOLLOWING_IDS_LIMIT truncation above. Switching is one
    // line, held back so this commit changes no live surface.
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

  return filterCloseFriends(data as unknown as Post[], userId);
}

// Filter close_friends posts: only show if the viewer is in the poster's
// close_friends list, mirroring the web getFeedPosts.
async function filterCloseFriends(posts: Post[], userId: string): Promise<Post[]> {
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

/**
 * How many delivered ids ride along as `p_exclude`. The RPC only needs to
 * know what is already on screen, and an unbounded array would grow into
 * every request for the rest of the session.
 */
export const RANKED_EXCLUDE_CAP = 200;

/**
 * One page of the server-ranked For You feed, in the order `feed_for_you`
 * returned, or null when the caller should use the chronological feed
 * instead. Null covers every failure: RPC error, hydration error, and a page
 * too thin to be worth showing (the ranker ran out of candidates).
 *
 * Only called for viewers inside the rollout, see isRankingEnabled.
 */
export async function getRankedFeedPosts(
  userId: string,
  excludeIds: string[] = [],
  limit = FEED_PAGE_SIZE,
): Promise<Post[] | null> {
  try {
    const { data, error } = await supabase.rpc("feed_for_you", {
      p_limit: limit,
      p_exclude: excludeIds,
    });
    if (error || !data) return null;

    const ids = (data as { post_id: string }[]).map((row) => row.post_id);
    if (ids.length * 2 < limit) return null;

    const byId = await getPostsByIds(ids);
    // getPostsByIds has its own order; the RPC's is the ranking.
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((post): post is Post => post !== undefined);

    return filterCloseFriends(ordered, userId);
  } catch {
    return null;
  }
}

// The page param carries either the chronological created_at cursor or, in
// ranked mode, the ids already delivered (the ranker has no cursor).
export interface FeedPageParam {
  cursor?: string;
  excludeIds?: string[];
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
  // Ids delivered so far, handed back to feed_for_you as p_exclude. Null on
  // every page that came from the chronological path.
  nextExcludeIds: string[] | null;
}

// ---------------------------------------------------------------------------
// Client-side For You ranking, used only for viewers outside the
// feed_for_you rollout. Delete this block once the rollout reaches everyone;
// the ranked path in getFeedPage never touches it.
//
// Mirrors the web scorePost in
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
// content_preferences topic adjustments and the demotion applied to
// content-warning posts for viewers with sensitive_content_level "less".
const TOPIC_SEE_LESS_PENALTY = -0.2;
const TOPIC_SEE_MORE_BOOST = 0.1;
const SENSITIVE_DEMOTION = -0.25;

// Additive adjustment from the viewer's content preferences: a see_less
// hashtag outweighs any see_more match, and sensitive (content-warning)
// posts are demoted for viewers who chose to see less sensitive content.
function preferenceAdjustment(post: Post, signals?: RankingSignals): number {
  if (!signals) return 0;
  let adjustment = 0;
  const tags = (post.content?.match(/#(\w+)/g) ?? []).map((t) =>
    t.slice(1).toLowerCase(),
  );
  if (tags.some((t) => signals.seeLessTopics.has(t))) {
    adjustment += TOPIC_SEE_LESS_PENALTY;
  } else if (tags.some((t) => signals.seeMoreTopics.has(t))) {
    adjustment += TOPIC_SEE_MORE_BOOST;
  }
  if (signals.demoteSensitive && post.content_warning) {
    adjustment += SENSITIVE_DEMOTION;
  }
  return adjustment;
}

function scorePost(post: Post, signals?: RankingSignals): number {
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

  return (
    recency * 0.5 +
    engagement * 0.2 +
    media * 0.05 +
    boosted +
    coldStart +
    preferenceAdjustment(post, signals)
  );
}

function rankPage(posts: Post[], signals?: RankingSignals): Post[] {
  if (posts.length <= 1) return posts;
  return posts
    .map((post) => ({ post, score: scorePost(post, signals) }))
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
  pageParam?: FeedPageParam,
): Promise<FeedPage> {
  const cursor = pageParam?.cursor;
  const excludeIds = pageParam?.excludeIds;

  // Server-side ranker, off for everyone outside the rollout. It returns
  // null on any failure, which drops this page onto the chronological path
  // below (including the client-side rankPage) with nothing surfaced to the
  // viewer.
  const rankedPosts =
    tab === "foryou" && (await isRankingEnabled(userId))
      ? await getRankedFeedPosts(userId, excludeIds ?? [])
      : null;

  let posts: Post[];
  let nextCursor: string | null;
  let nextExcludeIds: string[] | null;

  if (rankedPosts) {
    posts = rankedPosts;
    nextCursor = null;
    nextExcludeIds = [...(excludeIds ?? []), ...rankedPosts.map((p) => p.id)].slice(
      -RANKED_EXCLUDE_CAP,
    );
  } else {
    const fetched = await getFeedPosts(userId, tab, cursor);

    // Same page-exhaustion rule the screen used before ranking landed: a
    // short page means the walk is done.
    nextCursor =
      fetched.length < FEED_PAGE_SIZE ? null : fetched[fetched.length - 1].created_at;
    nextExcludeIds = null;

    // For You ranks within the fetched window; Following stays strictly
    // chronological and complete. Topic preferences and sensitivity
    // demotion ride along; the helper degrades to neutral on failure.
    const ordered =
      tab === "foryou" ? rankPage(fetched, await getRankingSignals(userId)) : fetched;

    // Dropping out of ranked mode mid-scroll restarts the chronological
    // walk at the newest post, so skip what the ranked pages delivered.
    if (excludeIds) {
      const delivered = new Set(excludeIds);
      posts = ordered.filter((p) => !delivered.has(p.id));
    } else {
      posts = ordered;
    }
  }

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

  return { posts, originals, reactionCounts, nextCursor, nextExcludeIds };
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

// Same shape the web PollData uses; poll_data is stored as-is in JSONB.
export interface PollData {
  options: { text: string; votes: number }[];
  ends_at: string;
  multi_select: boolean;
}

// Mirrors the web votePoll: one poll_votes row per user per post (the web
// UI never honors multi_select), then a denormalized bump of the votes
// count inside posts.poll_data so both apps read tallies from the post row.
export async function votePoll(userId: string, postId: string, optionIndex: number) {
  const { data: existingVote } = await supabase
    .from("poll_votes")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (existingVote) throw new Error("Already voted");

  const { error: voteError } = await supabase.from("poll_votes").insert({
    user_id: userId,
    post_id: postId,
    option_index: optionIndex,
  });
  if (voteError) throw voteError;

  const { data: post } = await supabase
    .from("posts")
    .select("poll_data")
    .eq("id", postId)
    .single();

  if (post?.poll_data) {
    const pollData = post.poll_data as PollData;
    pollData.options[optionIndex].votes += 1;

    const { error: updateError } = await supabase
      .from("posts")
      .update({ poll_data: pollData })
      .eq("id", postId);
    if (updateError) throw updateError;
  }
}

export async function getUserPollVote(userId: string, postId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("poll_votes")
    .select("option_index")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (error) throw error;
  return data?.option_index ?? null;
}

export interface NewPostMedia {
  url: string;
  type: "image" | "video" | "gif";
  width: number | null;
  height: number | null;
  durationMs?: number;
  altText?: string;
  // Poster frame for video media, so a feed tile can paint before the
  // video element decodes. Null for images.
  thumbnailUrl?: string | null;
}

// Same insert shape the web createPost uses, including the derived post
// type and the scheduled_at + is_hidden pairing that keeps scheduled
// posts out of every feed until the publisher flips them live.
export async function createPost(
  userId: string,
  content: string,
  options?: {
    replyToId?: string;
    type?: Post["type"];
    // Quote posts: type "quote" plus the quoted post's id. Never call
    // increment_post_reposts for quotes; server triggers own the quote
    // repost_count bump and the repost/quote notifications.
    parentPostId?: string;
    media?: NewPostMedia[];
    pollData?: PollData;
    scheduledAt?: string;
    visibility?: "public" | "close_friends";
    whoCanComment?: WhoCanComment;
    contentWarning?: string;
    location?: string;
  },
) {
  const media = options?.media ?? [];

  const postType =
    options?.type ||
    (media.length > 0
      ? media[0].type === "video"
        ? "video"
        : "image"
      : options?.pollData
        ? "poll"
        : "text");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content,
      type: postType,
      parent_post_id: options?.parentPostId || null,
      reply_to_id: options?.replyToId || null,
      poll_data: options?.pollData || null,
      visibility: options?.visibility || "public",
      who_can_comment: options?.whoCanComment || "everyone",
      content_warning: options?.contentWarning || null,
      location: options?.location || null,
      ...(options?.scheduledAt
        ? { scheduled_at: options.scheduledAt, is_hidden: true }
        : {}),
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
        thumbnail_url: m.thumbnailUrl ?? null,
        sort_order: i,
        ...(m.durationMs != null ? { duration_ms: Math.round(m.durationMs) } : {}),
        ...(m.altText ? { alt_text: m.altText } : {}),
      })),
    );
    if (mediaError) throw mediaError;
  }

  // Creator bell fanout: notify this author's bell subscribers. The RPC is a
  // drafted migration (20260803130000_bell_fanout_fn.sql) awaiting approval;
  // until it is applied the call errors and publishing proceeds unaffected.
  const fansOut =
    !options?.replyToId &&
    !options?.scheduledAt &&
    (options?.visibility ?? "public") === "public";
  if (fansOut) {
    try {
      await supabase.rpc("fan_out_new_post", { p_post_id: post.id });
    } catch {
      // Missing function or transient failure; the post itself succeeded.
    }
  }

  return post as unknown as Post;
}

export interface NewReelMedia {
  url: string;
  width: number | null;
  height: number | null;
  durationMs: number;
  // Cover frame uploaded by the gallery flow; the camera flow leaves it
  // unset and tiles fall back to on-device frame extraction.
  thumbnailUrl?: string | null;
  // Set when the clip was started from a sound page: the existing sound is
  // credited instead of a fresh "Original sound" row.
  soundId?: string | null;
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
    thumbnail_url: media.thumbnailUrl ?? null,
    width: media.width,
    height: media.height,
    duration_ms: Math.round(media.durationMs),
    sort_order: 0,
  });
  if (mediaError) throw mediaError;

  await attributeSound(userId, post.id as string, media);

  return post.id as string;
}

/**
 * Credits the clip to a sound: the one it was started from, or a fresh
 * "Original sound" row backed by the clip's own video. Attribution is
 * metadata only for now (no audio is extracted or mixed), and it is best
 * effort by design: a failure here must never cost a published clip.
 */
async function attributeSound(userId: string, postId: string, media: NewReelMedia) {
  try {
    let soundId = media.soundId ?? null;

    if (!soundId) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .single();
      if (profileError) throw profileError;

      const { data: sound, error: soundError } = await supabase
        .from("sounds")
        .insert({
          name: "Original sound",
          artist: profile.username,
          audio_url: media.url,
          duration_seconds: media.durationMs / 1000,
          cover_url: media.thumbnailUrl ?? null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (soundError) throw soundError;
      soundId = sound.id as string;
    }

    const { error: linkError } = await supabase
      .from("posts")
      .update({ sound_id: soundId })
      .eq("id", postId);
    if (linkError) throw linkError;

    const { error: useError } = await supabase.rpc("increment_sound_use", {
      p_sound_id: soundId,
    });
    if (useError) throw useError;
  } catch (error) {
    console.error("sound attribution failed", error);
  }
}

// Uploads into the same "post-media" bucket the web app uses, with the
// same {userId}/{timestamp}_{random}.{ext} path convention.
export async function uploadPostMedia(
  userId: string,
  uri: string,
  mimeType: string,
): Promise<string> {
  // Voice notes record as audio/mp4; name them .m4a because the web feed
  // detects audio media purely by URL extension (isAudioMediaItem).
  const ext = mimeType === "audio/mp4" ? "m4a" : (mimeType.split("/")[1] ?? "jpg");
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

// --- Scheduled posts ---

export interface ScheduledPost extends Post {
  scheduled_at: string | null;
}

// Mirrors the web getScheduledPosts: scheduled rows sit behind is_hidden
// until published, so they never leak into feeds. POST_SELECT does not carry
// scheduled_at (feeds never show it), hence the widened select here.
export async function getScheduledPosts(userId: string): Promise<ScheduledPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(`scheduled_at, ${POST_SELECT}`)
    .eq("user_id", userId)
    .eq("is_hidden", true)
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true });

  if (error) throw error;
  return data as unknown as ScheduledPost[];
}

export async function deletePost(postId: string) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}
