import { createClient } from "@/lib/supabase/client";
import { POST_SELECT, type PostWithAuthor } from "@/lib/queries/posts";
import type { ParsedSearch } from "@/lib/search-query";

/**
 * Search that acts on parsed operators rather than raw text.
 *
 * Mirrors orbit-mobile/src/lib/queries/search.ts. Kept in its own module so
 * the long-standing plain searchPosts keeps its shape for the callers that
 * only ever pass words.
 */

const supabase = createClient();

const FTS_MIN_QUERY_LENGTH = 3;

function isFtsQuery(query: string) {
  return (
    query.length >= FTS_MIN_QUERY_LENGTH &&
    !query.startsWith("#") &&
    !query.startsWith("@")
  );
}

/**
 * Resolves `from:` usernames to ids. Unknown names resolve to nothing, which
 * correctly returns no results rather than dropping the filter and showing
 * everyone's posts.
 */
async function resolveAuthorIds(usernames: string[]): Promise<string[]> {
  if (usernames.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("username", usernames);
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

export async function searchPostsAdvanced(
  parsed: ParsedSearch,
  limit = 30,
): Promise<PostWithAuthor[]> {
  const authorIds = await resolveAuthorIds(parsed.from);
  if (parsed.from.length > 0 && authorIds.length === 0) return [];

  let q = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (authorIds.length > 0) q = q.in("user_id", authorIds);
  if (parsed.after) q = q.gte("created_at", parsed.after);
  if (parsed.before) q = q.lte("created_at", parsed.before);
  for (const word of parsed.exclude) q = q.not("content", "ilike", `%${word}%`);

  if (parsed.text) {
    q = isFtsQuery(parsed.text)
      ? q.textSearch("search_vector", parsed.text, { type: "websearch" })
      : q.ilike("content", `%${parsed.text}%`);
  }
  // A link lives in the text, so it is a content match rather than a join.
  if (parsed.has.includes("link")) q = q.ilike("content", "%http%");

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as unknown as PostWithAuthor[];
  // Media requirements filter after the fetch: post_media is a to-many join
  // and PostgREST cannot express "has at least one row of this type" as a
  // filter on the parent without an RPC.
  const wantsImage = parsed.has.includes("image");
  const wantsVideo = parsed.has.includes("video");
  if (wantsImage || wantsVideo) {
    rows = rows.filter((post) =>
      post.post_media.some(
        (m) =>
          (wantsImage && (m.type === "image" || m.type === "gif")) ||
          (wantsVideo && m.type === "video"),
      ),
    );
  }
  return rows;
}

export interface MessageHit {
  id: string;
  conversation_id: string;
  content: string;
  created_at: string;
  sender: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

/**
 * Searches the viewer's own messages.
 *
 * No viewer filter is applied here on purpose: the messages SELECT policy
 * already scopes rows to conversations the caller belongs to, so a rule here
 * could only duplicate that one or contradict it.
 */
export async function searchMessages(
  parsed: ParsedSearch,
  limit = 40,
): Promise<MessageHit[]> {
  if (!parsed.text) return [];

  let q = supabase
    .from("messages")
    .select(
      `id, conversation_id, content, created_at,
       sender:profiles!messages_sender_id_fkey (username, display_name, avatar_url)`,
    )
    .eq("is_deleted", false)
    .ilike("content", `%${parsed.text}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (parsed.after) q = q.gte("created_at", parsed.after);
  if (parsed.before) q = q.lte("created_at", parsed.before);
  for (const word of parsed.exclude) q = q.not("content", "ilike", `%${word}%`);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as MessageHit[];
}

async function postsByIds(postIds: string[]): Promise<Map<string, PostWithAuthor>> {
  if (postIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .in("id", postIds);
  if (error) throw error;
  return new Map(
    ((data ?? []) as unknown as PostWithAuthor[]).map((p) => [p.id, p]),
  );
}

/** Searches inside what the viewer saved, including their own notes. */
export async function searchSaved(
  userId: string,
  parsed: ParsedSearch,
  limit = 40,
): Promise<PostWithAuthor[]> {
  const { data: rows, error } = await supabase
    .from("bookmarks")
    .select("post_id, note")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const posts = await postsByIds(rows.map((r) => r.post_id));
  const needle = parsed.text.toLowerCase();
  return rows
    .map((row) => ({ post: posts.get(row.post_id), note: row.note }))
    .filter(({ post, note }) => {
      if (!post || post.is_hidden) return false;
      if (!needle) return true;
      // The note is the viewer's own words about why they kept it, which is
      // often the only thing they remember a year later.
      return (
        post.content?.toLowerCase().includes(needle) ||
        (note as string | null)?.toLowerCase().includes(needle)
      );
    })
    .slice(0, limit)
    .map(({ post }) => post!) as PostWithAuthor[];
}

/** Searches the posts the viewer liked. */
export async function searchLiked(
  userId: string,
  parsed: ParsedSearch,
  limit = 40,
): Promise<PostWithAuthor[]> {
  const { data: rows, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const posts = await postsByIds(rows.map((r) => r.post_id));
  const needle = parsed.text.toLowerCase();
  return rows
    .map((row) => posts.get(row.post_id))
    .filter(
      (post): post is PostWithAuthor =>
        !!post &&
        !post.is_hidden &&
        (!needle || !!post.content?.toLowerCase().includes(needle)),
    )
    .slice(0, limit);
}
