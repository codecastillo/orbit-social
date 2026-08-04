import { supabase } from "@/lib/supabase";
import type { StoryWithAuthor } from "@/lib/queries/stories";

// Same web origin the live chat and unfurl calls use. Highlights go through
// the web API because story_highlight_items has no INSERT policy (client
// writes are denied), and the route reads members with the service role so
// a highlight's moments stay visible to visitors past the 24h window.
const HIGHLIGHTS_API_BASE = "https://orbitsocial.net";

export interface HighlightWithStories {
  id: string;
  user_id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
  stories: StoryWithAuthor[];
}

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function getHighlights(
  userId: string,
): Promise<HighlightWithStories[]> {
  const token = await getAccessToken();
  const res = await fetch(
    `${HIGHLIGHTS_API_BASE}/api/highlights?userId=${encodeURIComponent(userId)}`,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
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
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch(`${HIGHLIGHTS_API_BASE}/api/highlights`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, storyIds }),
  });
  if (!res.ok) throw new Error(`highlight create failed (${res.status})`);
}

/**
 * Append the caller's own moments to an existing highlight of theirs. The
 * route enforces ownership of both sides, and silently skips ids already in
 * the highlight. It still rejects expired moments; that check is the web
 * app's to relax now that the owner can read their own archive.
 */
export async function addStoriesToHighlight(
  highlightId: string,
  storyIds: string[],
): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch(`${HIGHLIGHTS_API_BASE}/api/highlights`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ highlightId, storyIds }),
  });
  if (!res.ok) throw new Error(`highlight update failed (${res.status})`);
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
 * All of the owner's moments, newest first (same order as the archive), as
 * the highlight picker's source. The stories SELECT policy carves out the
 * author (`expires_at > NOW() OR auth.uid() = user_id`), so expired rows
 * are readable here and a highlight can be assembled from the archive.
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
