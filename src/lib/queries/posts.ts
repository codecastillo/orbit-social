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
  share_count?: number;
  view_count: number;
  bookmark_count: number;
  poll_data: PollData | null;
  is_pinned: boolean;
  is_hidden: boolean;
  location: string | null;
  scheduled_at: string | null;
  visibility: "public" | "close_friends";
  content_warning: string | null;
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
    scheduledAt?: string;
    visibility?: "public" | "close_friends";
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
    .not("type", "eq", "reel")
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

  // Filter close_friends posts: only show if the viewer is in the poster's close_friends list
  const posts = data as PostWithAuthor[];
  const closeFriendsPosts = posts.filter(
    (p: any) => p.visibility === "close_friends" && p.user_id !== userId
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

    return posts.filter((p: any) => {
      if (p.visibility !== "close_friends") return true;
      if (p.user_id === userId) return true;
      return allowedPosterIds.has(p.user_id);
    });
  }

  return posts;
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
    .eq("is_hidden", false);

  if (error) throw error;
  // Maintain the liked order
  const postMap = new Map((data || []).map((p) => [p.id, p]));
  return postIds.map((id) => postMap.get(id)).filter(Boolean) as PostWithAuthor[];
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
    .eq("is_hidden", false);

  if (error) throw error;
  const postMap = new Map((data || []).map((p) => [p.id, p]));
  return postIds.map((id) => postMap.get(id)).filter(Boolean) as PostWithAuthor[];
}

export async function getUserRepostedPosts(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .eq("type", "repost")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

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

export async function updatePost(postId: string, content: string) {
  const { data, error } = await supabase
    .from("posts")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", postId)
    .select(POST_SELECT)
    .single();

  if (error) throw error;
  return data as PostWithAuthor;
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

  return post as PostWithAuthor;
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
  return data as PostWithAuthor;
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
  return data as PostWithAuthor[];
}

export async function getPostsByHashtag(tag: string, cursor?: string, limit = 20) {
  // Find the hashtag first
  const normalizedTag = tag.toLowerCase().replace(/^#/, "");

  const { data: hashtag } = await supabase
    .from("hashtags")
    .select("id, post_count")
    .eq("name", normalizedTag)
    .single();

  if (!hashtag) return { posts: [] as PostWithAuthor[], postCount: 0 };

  // Get post IDs with this hashtag, then fetch the full posts
  const { data: postHashtags, error: phError } = await supabase
    .from("post_hashtags")
    .select("post_id")
    .eq("hashtag_id", hashtag.id)
    .order("post_id", { ascending: false })
    .limit(limit);

  if (phError) throw phError;

  const postIds = postHashtags?.map((ph) => ph.post_id) ?? [];
  if (postIds.length === 0) return { posts: [] as PostWithAuthor[], postCount: hashtag.post_count || 0 };

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

  return { posts: (data ?? []) as PostWithAuthor[], postCount: hashtag.post_count || 0 };
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

export async function getUserPinnedPosts(userId: string): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .eq("is_pinned", true)
    .eq("is_hidden", false)
    .is("reply_to_id", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as PostWithAuthor[];
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
  return data as PostWithAuthor[];
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
  return data as PostWithAuthor;
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
  return data as PostWithAuthor;
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
