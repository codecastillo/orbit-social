import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface StoryWithAuthor {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  thumbnail_url: string | null;
  duration_seconds: number;
  interactive_data: Record<string, unknown> | null;
  text_overlay: Record<string, unknown> | null;
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

export async function createStory(
  userId: string,
  mediaUrl: string,
  mediaType: "image" | "video",
  options?: {
    thumbnailUrl?: string;
    durationSeconds?: number;
    interactiveData?: Record<string, unknown>;
    textOverlay?: Record<string, unknown>;
    visibility?: string;
  }
) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const { data, error } = await supabase
    .from("stories")
    .insert({
      user_id: userId,
      media_url: mediaUrl,
      media_type: mediaType,
      thumbnail_url: options?.thumbnailUrl || null,
      duration_seconds: options?.durationSeconds || 5,
      interactive_data: options?.interactiveData || null,
      text_overlay: options?.textOverlay || null,
      visibility: options?.visibility || "public",
      expires_at: expiresAt.toISOString(),
    })
    .select(
      `*, profiles!stories_user_id_fkey (id, username, display_name, avatar_url, is_verified)`
    )
    .single();

  if (error) throw error;
  return data as StoryWithAuthor;
}

export async function getActiveStories(
  userId: string
): Promise<StoryGroup[]> {
  // Get following list
  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  const followingIds = following?.map((f) => f.following_id) || [];
  followingIds.push(userId); // Include own stories

  // Get active (non-expired) stories from followed users
  const { data: stories, error } = await supabase
    .from("stories")
    .select(
      `*, profiles!stories_user_id_fkey (id, username, display_name, avatar_url, is_verified)`
    )
    .in("user_id", followingIds)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!stories || stories.length === 0) return [];

  // Get which stories the current user has already viewed
  const storyIds = stories.map((s) => s.id);
  const { data: views } = await supabase
    .from("story_views")
    .select("story_id")
    .eq("viewer_id", userId)
    .in("story_id", storyIds);

  const viewedIds = new Set(views?.map((v) => v.story_id) || []);

  // Group by user
  const groupMap = new Map<string, StoryGroup>();

  for (const story of stories as StoryWithAuthor[]) {
    const uid = story.user_id;
    if (!groupMap.has(uid)) {
      groupMap.set(uid, {
        user: story.profiles,
        stories: [],
        hasUnviewed: false,
      });
    }
    const group = groupMap.get(uid)!;
    group.stories.push(story);
    if (!viewedIds.has(story.id)) {
      group.hasUnviewed = true;
    }
  }

  // Sort: current user first, then users with unviewed stories, then rest
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

export async function getStoryById(storyId: string) {
  const { data, error } = await supabase
    .from("stories")
    .select(
      `*, profiles!stories_user_id_fkey (id, username, display_name, avatar_url, is_verified)`
    )
    .eq("id", storyId)
    .single();

  if (error) throw error;
  return data as StoryWithAuthor;
}

export async function markStoryViewed(storyId: string, viewerId: string) {
  const { error } = await supabase
    .from("story_views")
    .upsert(
      { story_id: storyId, viewer_id: viewerId },
      { onConflict: "story_id,viewer_id" }
    );

  if (error) throw error;
}

export async function getStoryViewers(storyId: string) {
  const { data, error } = await supabase
    .from("story_views")
    .select(
      `viewer_id, viewed_at, profiles:viewer_id (id, username, display_name, avatar_url, is_verified)`
    )
    .eq("story_id", storyId)
    .order("viewed_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteStory(storyId: string) {
  const { error } = await supabase
    .from("stories")
    .delete()
    .eq("id", storyId);

  if (error) throw error;
}

export async function uploadStoryMedia(
  userId: string,
  file: File
): Promise<{ url: string; type: "image" | "video" }> {
  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("story-media")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("story-media").getPublicUrl(filePath);

  const type = file.type.startsWith("video/") ? "video" : "image";

  return { url: publicUrl, type };
}
