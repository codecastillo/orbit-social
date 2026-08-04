import { createClient } from "@/lib/supabase/client";
import type { StoryWithAuthor } from "@/lib/queries/stories";

const supabase = createClient();

export interface HighlightWithStories {
  id: string;
  user_id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
  stories: StoryWithAuthor[];
}

// Reads and creates go through /api/highlights instead of PostgREST:
// story_highlight_items only carries a SELECT policy so client item writes
// are denied, and the stories SELECT policy hides expired rows from every
// viewer but their author, which would empty a highlight after 24h. The
// route reads members with the service role and enforces ownership on
// writes.

export async function getHighlights(
  userId: string,
): Promise<HighlightWithStories[]> {
  const res = await fetch(
    `/api/highlights?userId=${encodeURIComponent(userId)}`,
    { credentials: "same-origin" },
  );
  if (!res.ok) throw new Error(`highlights fetch failed (${res.status})`);
  const { highlights } = (await res.json()) as {
    highlights: HighlightWithStories[];
  };
  return highlights;
}

export async function createHighlight(
  title: string,
  storyIds: string[],
): Promise<void> {
  const res = await fetch("/api/highlights", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, storyIds }),
  });
  if (!res.ok) throw new Error(`highlight create failed (${res.status})`);
}

// Deleting only touches story_highlights, where the owner's FOR ALL policy
// applies; items cascade at the database level.
export async function deleteHighlight(highlightId: string): Promise<void> {
  const { error } = await supabase
    .from("story_highlights")
    .delete()
    .eq("id", highlightId);
  if (error) throw error;
}

/**
 * Append the caller's own moments to an existing highlight of theirs. The
 * route enforces ownership of both sides and silently skips ids already in
 * the highlight.
 */
export async function addStoriesToHighlight(
  highlightId: string,
  storyIds: string[],
): Promise<void> {
  const res = await fetch("/api/highlights", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ highlightId, storyIds }),
  });
  if (!res.ok) throw new Error(`highlight update failed (${res.status})`);
}

/**
 * All of the owner's moments, newest first (same order as the archive), as
 * the highlight picker's source. The stories SELECT policy carves out the
 * author (`expires_at > NOW() OR auth.uid() = user_id`), so expired rows are
 * readable here and a highlight can be assembled from the archive.
 */
export async function getOwnStories(
  userId: string,
): Promise<StoryWithAuthor[]> {
  const { data, error } = await supabase
    .from("stories")
    .select(
      `id, user_id, media_url, media_type, thumbnail_url, duration_seconds,
       interactive_data, text_overlay, visibility, view_count, expires_at,
       created_at,
       profiles!stories_user_id_fkey (id, username, display_name, avatar_url, is_verified)`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  // Through unknown: the literal-type query parser infers the to-one
  // profiles join as an array without generated DB types.
  return (data ?? []) as unknown as StoryWithAuthor[];
}
