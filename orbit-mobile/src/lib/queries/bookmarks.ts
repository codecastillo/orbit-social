import { supabase } from "@/lib/supabase";
import { getPostsByIds, type Post } from "@/lib/queries/posts";

const BOOKMARKS_LIMIT = 50;

/**
 * The viewer's saved posts, newest save first. Mirrors the web
 * getUserBookmarkedPosts: fetch the bookmark rows for ordering, then
 * hydrate the posts and keep the saved order.
 */
export async function getBookmarkedPosts(userId: string): Promise<Post[]> {
  const { data: bookmarks, error } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(BOOKMARKS_LIMIT);

  if (error) throw error;
  if (!bookmarks || bookmarks.length === 0) return [];

  const posts = await getPostsByIds(bookmarks.map((b) => b.post_id));
  return bookmarks
    .map((b) => posts.get(b.post_id))
    .filter((p): p is Post => !!p && !p.is_hidden);
}

export async function removeBookmark(userId: string, postId: string) {
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("post_id", postId);

  if (error) throw error;
}
