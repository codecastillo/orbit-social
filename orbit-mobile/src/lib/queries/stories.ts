import { supabase } from "@/lib/supabase";

export interface StoryWithAuthor {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  thumbnail_url: string | null;
  duration_seconds: number;
  visibility: string;
  view_count: number;
  expires_at: string;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

export interface StoryGroup {
  user: StoryWithAuthor["profiles"];
  stories: StoryWithAuthor[];
  hasUnviewed: boolean;
}

// Bounded so a huge follow graph can't blow up every load, matching the
// web query's ceiling.
const FOLLOWING_FETCH_LIMIT = 1000;
const STORY_FETCH_LIMIT = 100;

/**
 * Active (non-expired) stories from followed users plus the viewer's own,
 * grouped per author. Public visibility only for v1; the web app's
 * close_friends filtering can come later.
 */
export async function getActiveStories(userId: string): Promise<StoryGroup[]> {
  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
    .limit(FOLLOWING_FETCH_LIMIT);

  const authorIds = (following ?? []).map((f) => f.following_id);
  authorIds.push(userId);

  const { data: stories, error } = await supabase
    .from("stories")
    .select(
      `id, user_id, media_url, media_type, thumbnail_url, duration_seconds,
       visibility, view_count, expires_at, created_at,
       profiles!stories_user_id_fkey (id, username, display_name, avatar_url, is_verified)`,
    )
    .in("user_id", authorIds)
    .eq("visibility", "public")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(STORY_FETCH_LIMIT);

  if (error) throw error;
  if (!stories || stories.length === 0) return [];

  // Through unknown: the literal-type query parser infers the to-one
  // profiles join as an array without generated DB types.
  const visibleStories = stories as unknown as StoryWithAuthor[];

  const { data: views } = await supabase
    .from("story_views")
    .select("story_id")
    .eq("viewer_id", userId)
    .in(
      "story_id",
      visibleStories.map((s) => s.id),
    );

  const viewedIds = new Set((views ?? []).map((v) => v.story_id));

  const groupMap = new Map<string, StoryGroup>();
  for (const story of visibleStories) {
    let group = groupMap.get(story.user_id);
    if (!group) {
      group = { user: story.profiles, stories: [], hasUnviewed: false };
      groupMap.set(story.user_id, group);
    }
    group.stories.push(story);
    if (!viewedIds.has(story.id)) {
      group.hasUnviewed = true;
    }
  }

  // Current user first, then authors with unviewed stories, then the rest.
  const groups = Array.from(groupMap.values());
  groups.sort((a, b) => {
    if (a.user.id === userId) return -1;
    if (b.user.id === userId) return 1;
    if (a.hasUnviewed && !b.hasUnviewed) return -1;
    if (!a.hasUnviewed && b.hasUnviewed) return 1;
    return 0;
  });

  return groups;
}

export async function markStoryViewed(storyId: string, viewerId: string) {
  const { error } = await supabase
    .from("story_views")
    .upsert(
      { story_id: storyId, viewer_id: viewerId },
      { onConflict: "story_id,viewer_id" },
    );

  if (error) throw error;
}
