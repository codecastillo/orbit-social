import { supabase } from "@/lib/supabase";
import type { StoryWithAuthor } from "@/lib/queries/stories";

// Same web origin the live chat and unfurl calls use. Highlights go through
// the web API because story_highlight_items has no INSERT policy (client
// writes are denied) and the stories SELECT policy hides expired rows from
// everyone; the route reads members with the service role so highlights
// outlive the 24h story window.
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
 * The owner's active stories, oldest first, as the highlight picker's
 * source. The stories SELECT policy (expires_at > NOW()) has no owner
 * carve-out, so expired stories are unreadable and highlights can only be
 * assembled from active ones. Mirrors the web getOwnActiveStories.
 */
export async function getOwnActiveStories(
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
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;
  // Through unknown: the literal-type query parser infers the to-one
  // profiles join as an array without generated DB types.
  return (data ?? []) as unknown as StoryWithAuthor[];
}
