import { supabase } from "@/lib/supabase";
import { getPostsByIds, type Post } from "@/lib/queries/posts";

const BOOKMARKS_LIMIT = 50;

export interface BookmarkCollection {
  id: string;
  name: string;
  created_at: string;
}

/** A saved post plus the filing the viewer gave it. */
export interface SavedPost {
  post: Post;
  collection_id: string | null;
  note: string | null;
}

/**
 * The viewer's saved posts, newest save first, each with the collection it
 * was filed into and the note they left on it. Two queries rather than a
 * join because the ordering lives on the bookmark row and the post bodies
 * come back in their own order.
 *
 * `collectionId` filters to one collection; pass null for everything.
 */
export async function getSavedPosts(
  userId: string,
  collectionId?: string | null,
): Promise<SavedPost[]> {
  let query = supabase
    .from("bookmarks")
    .select("post_id, collection_id, note")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(BOOKMARKS_LIMIT);
  if (collectionId) query = query.eq("collection_id", collectionId);

  const { data: bookmarks, error } = await query;
  if (error) throw error;
  if (!bookmarks || bookmarks.length === 0) return [];

  const posts = await getPostsByIds(bookmarks.map((b) => b.post_id));
  return bookmarks
    .map((b) => {
      const post = posts.get(b.post_id);
      return post && !post.is_hidden
        ? { post, collection_id: b.collection_id, note: b.note }
        : null;
    })
    .filter((entry): entry is SavedPost => entry !== null);
}

/** Kept for callers that only need the posts. */
export async function getBookmarkedPosts(userId: string): Promise<Post[]> {
  return (await getSavedPosts(userId)).map((entry) => entry.post);
}

export async function getBookmarkCollections(userId: string) {
  const { data, error } = await supabase
    .from("bookmark_collections")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BookmarkCollection[];
}

export async function createBookmarkCollection(userId: string, name: string) {
  const { data, error } = await supabase
    .from("bookmark_collections")
    .insert({ user_id: userId, name: name.trim() })
    .select("id, name, created_at")
    .single();
  if (error) throw error;
  return data as BookmarkCollection;
}

/**
 * Deleting a collection leaves its saves alone: the foreign key is SET NULL,
 * so they return to the unfiled list rather than disappearing with the folder
 * someone was only reorganising.
 */
export async function deleteBookmarkCollection(collectionId: string) {
  const { error } = await supabase
    .from("bookmark_collections")
    .delete()
    .eq("id", collectionId);
  if (error) throw error;
}

/** Files a save into a collection (null unfiles it) and sets its note. */
export async function updateBookmark(
  userId: string,
  postId: string,
  patch: { collectionId?: string | null; note?: string | null },
) {
  const updates: Record<string, string | null> = {};
  if ("collectionId" in patch) updates.collection_id = patch.collectionId ?? null;
  if ("note" in patch) updates.note = patch.note?.trim() || null;
  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from("bookmarks")
    .update(updates)
    .eq("user_id", userId)
    .eq("post_id", postId);
  if (error) throw error;
}

export async function removeBookmark(userId: string, postId: string) {
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("post_id", postId);

  if (error) throw error;
}
