import { createClient } from "@/lib/supabase/client";
import type { PostFormData } from "@/lib/utils/validators";

const supabase = createClient();

/** posts.who_can_comment. Enforced by a BEFORE INSERT trigger on comments. */
export type WhoCanComment = "everyone" | "following" | "nobody";

/** Message the who_can_comment trigger raises when a comment is refused. */
export const COMMENTS_CLOSED_ERROR = "comments_closed";

/**
 * True when a failed comment insert was refused by the who_can_comment
 * trigger rather than by anything else. Callers show the limited-comments
 * copy instead of a generic failure.
 */
export function isCommentsClosedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { message, details, hint } = error as Record<string, unknown>;
  return [message, details, hint].some(
    (field) => typeof field === "string" && field.includes(COMMENTS_CLOSED_ERROR)
  );
}

/**
 * Who the viewer is allowed to reply as, computed client-side for UX only:
 * the trigger is the real gate. "following" means the post's author follows
 * the viewer, which is why authorFollowsViewer has to be resolved by the
 * caller.
 */
export function canViewerComment(
  post: Pick<PostWithAuthor, "user_id" | "who_can_comment">,
  viewerId: string | undefined,
  authorFollowsViewer: boolean
): boolean {
  if (!viewerId) return false;
  if (post.user_id === viewerId) return true;
  switch (post.who_can_comment) {
    case "nobody":
      return false;
    case "following":
      return authorFollowsViewer;
    default:
      return true;
  }
}

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
  share_count?: number;
  view_count: number;
  bookmark_count: number;
  // Completed playback loops, reels only (increment_clip_loops RPC).
  loop_count?: number;
  poll_data: PollData | null;
  is_pinned: boolean;
  is_hidden: boolean;
  location: string | null;
  scheduled_at: string | null;
  visibility: "public" | "close_friends";
  who_can_comment: WhoCanComment;
  content_warning: string | null;
  boosted_until?: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
    // Author-size signals for feed ranking (cold-start detection).
    follower_count?: number;
    post_count?: number;
  };
  post_media: MediaItem[];
  // Attributed sound, embedded by the clip queries only (CLIP_SELECT).
  sound?: {
    id: string;
    name: string;
    artist: string | null;
  } | null;
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
  duration_ms?: number | null;
  alt_text?: string | null;
}

export interface PollData {
  options: { text: string; votes: number }[];
  ends_at: string;
  multi_select: boolean;
}

// Casts below go through unknown because the literal-type query parser
// infers the to-one profiles join as an array without generated DB types.
const POST_SELECT = `
  id, user_id, content, type, parent_post_id, reply_to_id, community_id,
  like_count, comment_count, repost_count, share_count, view_count,
  bookmark_count, poll_data, is_pinned, is_hidden, location, scheduled_at,
  visibility, who_can_comment, content_warning, boosted_until, created_at,
  updated_at,
  profiles!posts_user_id_fkey (
    id, username, display_name, avatar_url, is_verified,
    follower_count, post_count
  ),
  post_media (
    id, type, url, thumbnail_url, width, height, blurhash, sort_order,
    duration_ms, alt_text
  )
`;

export async function createPost(
  userId: string,
  data: PostFormData,
  mediaUrls: { url: string; type: "image" | "video" | "gif"; altText?: string }[] = [],
  options?: {
    replyToId?: string;
    parentPostId?: string;
    type?: PostWithAuthor["type"];
    pollData?: PollData;
    scheduledAt?: string;
    visibility?: "public" | "close_friends";
    whoCanComment?: WhoCanComment;
    contentWarning?: string;
    location?: string;
    communityId?: string;
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
      visibility: options?.visibility || "public",
      who_can_comment: options?.whoCanComment || "everyone",
      content_warning: options?.contentWarning || null,
      location: options?.location || null,
      community_id: options?.communityId || null,
      ...(options?.scheduledAt
        ? { scheduled_at: options.scheduledAt, is_hidden: true }
        : {}),
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
      ...(m.altText ? { alt_text: m.altText } : {}),
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

  // Creator bell fanout: notify this author's bell subscribers. The RPC is a
  // drafted migration (20260803130000_bell_fanout_fn.sql) awaiting approval;
  // until it is applied the call errors and publishing proceeds unaffected.
  const fansOut =
    !options?.replyToId &&
    !options?.scheduledAt &&
    !options?.communityId &&
    (options?.visibility ?? "public") === "public";
  if (fansOut) {
    try {
      await supabase.rpc("fan_out_new_post", { p_post_id: post.id });
    } catch {
      // Missing function or transient failure; the post itself succeeded.
    }
  }

  return post;
}

// Past this many follows the Following tab needs a server-side join rather
// than an IN list, so the graph is read in a bounded slice.
const FOLLOWING_IDS_LIMIT = 1000;

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
    // Room posts stay inside the room, they never leak into the global
    // For You / Following feeds, even for the room's own members.
    .is("community_id", null)
    .eq("is_hidden", false)
    .not("type", "eq", "reel")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  if (tab === "following") {
    // The `following_feed(p_limit, p_cursor)` RPC does this join server-side
    // and removes the FOLLOWING_IDS_LIMIT truncation above. Switching is one
    // line, held back so this commit changes no live surface.
    const { data: following } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .limit(FOLLOWING_IDS_LIMIT);

    const followingIds = following?.map((f) => f.following_id) || [];
    followingIds.push(userId); // Include own posts

    if (followingIds.length > 0) {
      query = query.in("user_id", followingIds);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  return filterCloseFriends(data as unknown as PostWithAuthor[], userId);
}

// Filter close_friends posts: only show if the viewer is in the poster's close_friends list
async function filterCloseFriends(
  posts: PostWithAuthor[],
  userId: string
): Promise<PostWithAuthor[]> {
  const closeFriendsPosts = posts.filter(
    (p) => p.visibility === "close_friends" && p.user_id !== userId
  );

  if (closeFriendsPosts.length > 0) {
    // Get which posters have the viewer as a close friend
    const posterIds = [...new Set(closeFriendsPosts.map((p) => p.user_id))];
    const { data: cfData } = await supabase
      .from("close_friends")
      .select("user_id")
      .in("user_id", posterIds)
      .eq("friend_id", userId);

    const allowedPosterIds = new Set(
      (cfData ?? []).map((cf) => cf.user_id)
    );

    return posts.filter((p) => {
      if (p.visibility !== "close_friends") return true;
      if (p.user_id === userId) return true;
      return allowedPosterIds.has(p.user_id);
    });
  }

  return posts;
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
  limit = 20
): Promise<PostWithAuthor[] | null> {
  try {
    const { data, error } = await supabase.rpc("feed_for_you", {
      p_limit: limit,
      p_exclude: excludeIds,
    });
    if (error || !data) return null;

    const ids = (data as { post_id: string }[]).map((row) => row.post_id);
    if (ids.length * 2 < limit) return null;

    const { data: rows, error: hydrateError } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .in("id", ids);
    if (hydrateError || !rows) return null;

    const byId = new Map(
      (rows as unknown as PostWithAuthor[]).map((post) => [post.id, post])
    );
    // The hydration query has its own order; the RPC's is the ranking.
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((post): post is PostWithAuthor => post !== undefined);

    return filterCloseFriends(ordered, userId);
  } catch {
    return null;
  }
}

/**
 * created_at of the newest post this viewer's feed would show, or null when
 * the feed is empty. Selected on its own so the freshness check behind the
 * "New posts" pill costs one indexed row instead of a whole page.
 *
 * Close-friends filtering is deliberately skipped: it happens client-side
 * after the fetch, and the worst case here is a pill that scrolls the user
 * to a feed that looks unchanged.
 */
export async function getNewestFeedPostAt(
  userId: string | null,
  tab: "foryou" | "following"
): Promise<string | null> {
  let query = supabase
    .from("posts")
    .select("created_at")
    .is("reply_to_id", null)
    .is("community_id", null)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!userId) {
    // Same shape as getPublicTimeline, which is what anon viewers read.
    query = query.eq("visibility", "public").not("type", "in", "(reel,repost)");
  } else {
    query = query.not("type", "eq", "reel");
    if (tab === "following") {
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .limit(FOLLOWING_IDS_LIMIT);

      const followingIds = following?.map((f) => f.following_id) ?? [];
      followingIds.push(userId);
      query = query.in("user_id", followingIds);
    }
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.created_at ?? null;
}

// Public timeline: newest non-private posts platform-wide. Used for anon
// visitors browsing /feed in read-only mode (no follows = no personalized
// feed possible). Excludes reels (clip-feed surface), reposts (need viewer
// to dedupe), close-friends visibility (gated content), and hidden posts.
export async function getPublicTimeline(cursor?: string, limit = 20) {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .is("reply_to_id", null)
    .is("community_id", null)
    .eq("is_hidden", false)
    .eq("visibility", "public")
    .not("type", "in", "(reel,repost)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as PostWithAuthor[];
}

export async function getPostById(postId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .single();

  if (error) throw error;
  return data as unknown as PostWithAuthor;
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
  return data as unknown as PostWithAuthor[];
}

export async function getUserPosts(userId: string, cursor?: string, limit = 20) {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .is("reply_to_id", null)
    .is("community_id", null)
    .eq("is_hidden", false)
    .not("type", "in", "(reel,repost)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as PostWithAuthor[];
}

/**
 * How many of an account's posts the viewer can actually read, replies and
 * clips included. Compared against the profile's own `post_count` (a counter
 * column, so it is not RLS-filtered) it tells a profile whose content the
 * server is hiding apart from one that simply has nothing to show.
 */
export async function countVisiblePosts(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_hidden", false);
  if (error) throw error;
  return count ?? 0;
}

export async function getUserClips(userId: string, limit = 60) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .eq("type", "reel")
    .eq("is_hidden", false)
    .is("community_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as PostWithAuthor[];
}

export async function getUserLikedPosts(userId: string, limit = 50) {
  const { data: likes, error: likesError } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (likesError) throw likesError;
  if (!likes || likes.length === 0) return [];

  const postIds = likes.map((l) => l.post_id);
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .in("id", postIds)
    .is("community_id", null)
    .eq("is_hidden", false);

  if (error) throw error;
  // Maintain the liked order
  const postMap = new Map((data || []).map((p) => [p.id, p]));
  return postIds.map((id) => postMap.get(id)).filter(Boolean) as unknown as PostWithAuthor[];
}

export async function getUserBookmarkedPosts(userId: string, limit = 50) {
  const { data: bookmarks, error: bmError } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (bmError) throw bmError;
  if (!bookmarks || bookmarks.length === 0) return [];

  const postIds = bookmarks.map((b) => b.post_id);
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .in("id", postIds)
    .is("community_id", null)
    .eq("is_hidden", false);

  if (error) throw error;
  const postMap = new Map((data || []).map((p) => [p.id, p]));
  return postIds.map((id) => postMap.get(id)).filter(Boolean) as unknown as PostWithAuthor[];
}

export async function getUserTaggedPosts(userId: string, limit = 30) {
  // Posts that @-mention `userId`. Joined through post_mentions (populated
  // by the sync_post_mentions trigger). Fetch the mention rows first,
  // then hydrate the underlying posts in mention-recency order so the
  // newest tag shows up at the top.
  const { data: mentions, error: mErr } = await supabase
    .from("post_mentions")
    .select("post_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (mErr) throw mErr;
  if (!mentions || mentions.length === 0) return [];

  const postIds = mentions.map((m) => m.post_id);
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .in("id", postIds)
    .is("community_id", null)
    .eq("is_hidden", false);

  if (error) throw error;
  const map = new Map((data ?? []).map((p) => [p.id, p]));
  return postIds
    .map((id) => map.get(id))
    .filter(Boolean) as unknown as PostWithAuthor[];
}

export interface ProfileTabCounts {
  posts: number;
  clips: number;
  reposts: number;
  tagged: number;
  likes: number;
  saved: number;
}

// Cheap "do you have anything to show on this tab" probe used to decide
// which profile tabs to render. All counts use head:true + count:exact so
// they don't pull rows over the wire.
export async function getProfileTabCounts(
  profileId: string,
  viewerId: string | undefined,
): Promise<ProfileTabCounts> {
  const includeSaved = !!viewerId && viewerId === profileId;

  const [
    postsRes,
    clipsRes,
    repostsRes,
    taggedRes,
    likesRes,
    savedRes,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profileId)
      .is("reply_to_id", null)
      .is("community_id", null)
      .eq("is_hidden", false)
      .not("type", "in", "(reel,repost)"),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profileId)
      .eq("type", "reel")
      .is("community_id", null)
      .eq("is_hidden", false),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profileId)
      .eq("type", "repost")
      .is("community_id", null)
      .eq("is_hidden", false),
    supabase
      .from("post_mentions")
      .select("post_id", { count: "exact", head: true })
      .eq("user_id", profileId),
    supabase
      .from("post_likes")
      .select("post_id", { count: "exact", head: true })
      .eq("user_id", profileId),
    includeSaved
      ? supabase
          .from("bookmarks")
          .select("post_id", { count: "exact", head: true })
          .eq("user_id", profileId)
      : Promise.resolve({ count: 0 } as { count: number | null }),
  ]);

  return {
    posts: postsRes.count ?? 0,
    clips: clipsRes.count ?? 0,
    reposts: repostsRes.count ?? 0,
    tagged: taggedRes.count ?? 0,
    likes: likesRes.count ?? 0,
    saved: savedRes.count ?? 0,
  };
}

export async function getUserRepostedPosts(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .eq("type", "repost")
    .is("community_id", null)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as PostWithAuthor[];
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

/**
 * Change who can reply to an already published post. RLS limits the update
 * to the author, so no extra ownership check is needed here.
 */
export async function updateWhoCanComment(
  postId: string,
  whoCanComment: WhoCanComment
) {
  const { error } = await supabase
    .from("posts")
    .update({ who_can_comment: whoCanComment })
    .eq("id", postId);

  if (error) throw error;
}

export async function deletePost(postId: string) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function updatePost(postId: string, content: string) {
  const { data, error } = await supabase
    .from("posts")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", postId)
    .select(POST_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as PostWithAuthor;
}

export async function createRepost(userId: string, postId: string) {
  // Check if already reposted
  const { data: existing } = await supabase
    .from("posts")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "repost")
    .eq("parent_post_id", postId)
    .maybeSingle();

  if (existing) throw new Error("Already reposted");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content: null,
      type: "repost",
      parent_post_id: postId,
    })
    .select(POST_SELECT)
    .single();

  if (error) throw error;

  // Bump repost_count via a SECURITY DEFINER RPC. A direct UPDATE here
  // would be silently blocked by RLS for posts not owned by the current
  // user, leaving the count stuck at 0.
  const { error: rpcError } = await supabase.rpc("increment_post_reposts", {
    p_post_id: postId,
  });
  if (rpcError) console.error("increment_post_reposts failed", rpcError);

  return post as unknown as PostWithAuthor;
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

export async function checkUserReposted(userId: string, postIds: string[]) {
  const { data, error } = await supabase
    .from("posts")
    .select("parent_post_id")
    .eq("user_id", userId)
    .eq("type", "repost")
    .in("parent_post_id", postIds);

  if (error) throw error;
  return new Set(data?.map((r) => r.parent_post_id) ?? []);
}

export async function getOriginalPost(postId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .single();

  if (error) throw error;
  return data as unknown as PostWithAuthor;
}

export async function getPostsByIds(postIds: string[]) {
  if (postIds.length === 0) return new Map<string, PostWithAuthor>();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .in("id", postIds);

  if (error) throw error;
  return new Map<string, PostWithAuthor>(
    ((data ?? []) as unknown as PostWithAuthor[]).map((p) => [p.id, p]),
  );
}

export async function getCommentReplies(commentId: string, cursor?: string, limit = 20) {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("reply_to_id", commentId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (cursor) {
    query = query.gt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as PostWithAuthor[];
}

export async function getPostsByHashtag(tag: string, cursor?: string, limit = 20) {
  // Find the hashtag first
  const normalizedTag = tag.toLowerCase().replace(/^#/, "");

  const { data: hashtag } = await supabase
    .from("hashtags")
    .select("id, post_count")
    .eq("name", normalizedTag)
    .single();

  if (!hashtag) return { posts: [] as unknown as PostWithAuthor[], postCount: 0 };

  // Get post IDs with this hashtag, then fetch the full posts
  const { data: postHashtags, error: phError } = await supabase
    .from("post_hashtags")
    .select("post_id")
    .eq("hashtag_id", hashtag.id)
    .order("post_id", { ascending: false })
    .limit(limit);

  if (phError) throw phError;

  const postIds = postHashtags?.map((ph) => ph.post_id) ?? [];
  if (postIds.length === 0) return { posts: [] as unknown as PostWithAuthor[], postCount: hashtag.post_count || 0 };

  let postsQuery = supabase
    .from("posts")
    .select(POST_SELECT)
    .in("id", postIds)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });

  if (cursor) {
    postsQuery = postsQuery.lt("created_at", cursor);
  }

  const { data, error } = await postsQuery;
  if (error) throw error;

  return { posts: (data ?? []) as unknown as PostWithAuthor[], postCount: hashtag.post_count || 0 };
}

export async function votePoll(userId: string, postId: string, optionIndex: number) {
  // Check if already voted
  const { data: existingVote } = await supabase
    .from("poll_votes")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (existingVote) throw new Error("Already voted");

  // Insert vote
  const { error: voteError } = await supabase
    .from("poll_votes")
    .insert({
      user_id: userId,
      post_id: postId,
      option_index: optionIndex,
    });

  if (voteError) throw voteError;

  // Update the poll_data on the post to increment the vote count
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

export async function getUserPollVote(userId: string, postId: string) {
  const { data, error } = await supabase
    .from("poll_votes")
    .select("option_index")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (error) throw error;
  return data?.option_index ?? null;
}

export async function getUserPollVotes(userId: string, postIds: string[]) {
  if (postIds.length === 0) return new Map<string, number>();
  const { data, error } = await supabase
    .from("poll_votes")
    .select("post_id, option_index")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (error) throw error;
  return new Map<string, number>(
    (data ?? []).map((v) => [v.post_id, v.option_index]),
  );
}

export async function pinPost(postId: string): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ is_pinned: true })
    .eq("id", postId);

  if (error) throw error;
}

export async function unpinPost(postId: string): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ is_pinned: false })
    .eq("id", postId);

  if (error) throw error;
}

// SECURITY DEFINER RPC: only the parent post's author may pin, and pinning
// clears any previously pinned sibling server-side.
export async function pinComment(commentId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.rpc("pin_comment", {
    p_comment_id: commentId,
    p_pinned: pinned,
  });

  if (error) throw error;
}

export async function getUserPinnedPosts(userId: string): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .eq("is_pinned", true)
    .eq("is_hidden", false)
    .is("reply_to_id", null)
    .is("community_id", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as unknown as PostWithAuthor[];
}

export async function checkUserInteractions(userId: string, postIds: string[]) {
  const [likesResult, bookmarksResult, repostsResult] = await Promise.all([
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
    // Reposts live in the posts table itself: a row with type='repost',
    // user_id = the reposter, and parent_post_id = the original. We look
    // up *which originals* the viewer has reposted so the icon fills in
    // wherever those originals appear (Likes tab, Reposts tab, feed).
    supabase
      .from("posts")
      .select("parent_post_id")
      .eq("user_id", userId)
      .eq("type", "repost")
      .in("parent_post_id", postIds),
  ]);

  const likedPostIds = new Set(likesResult.data?.map((l) => l.post_id));
  const bookmarkedPostIds = new Set(bookmarksResult.data?.map((b) => b.post_id));
  const repostedPostIds = new Set(
    repostsResult.data
      ?.map((r) => r.parent_post_id)
      .filter((id): id is string => !!id),
  );

  return { likedPostIds, bookmarkedPostIds, repostedPostIds };
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

// --- Scheduled Posts ---

export async function getScheduledPosts(userId: string): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .eq("is_hidden", true)
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true });

  if (error) throw error;
  return data as unknown as PostWithAuthor[];
}

export async function publishScheduledPost(postId: string): Promise<PostWithAuthor> {
  const { data, error } = await supabase
    .from("posts")
    .update({
      is_hidden: false,
      scheduled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select(POST_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as PostWithAuthor;
}

export async function updateScheduledTime(postId: string, scheduledAt: string): Promise<PostWithAuthor> {
  const { data, error } = await supabase
    .from("posts")
    .update({
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select(POST_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as PostWithAuthor;
}

/**
 * Client-side check: publishes any posts whose scheduled_at has passed.
 * Called on feed load to ensure scheduled posts appear on time.
 */
export async function publishDueScheduledPosts(userId: string): Promise<number> {
  const { data: duePosts, error: fetchError } = await supabase
    .from("posts")
    .select("id")
    .eq("user_id", userId)
    .eq("is_hidden", true)
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString());

  if (fetchError) throw fetchError;
  if (!duePosts || duePosts.length === 0) return 0;

  const { error: updateError } = await supabase
    .from("posts")
    .update({
      is_hidden: false,
      updated_at: new Date().toISOString(),
    })
    .in(
      "id",
      duePosts.map((p) => p.id)
    );

  if (updateError) throw updateError;
  return duePosts.length;
}
