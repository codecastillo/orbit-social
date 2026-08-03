import { createClient } from "@/lib/supabase/client";
import { getOrCreateDMConversation, sendMessage } from "@/lib/queries/messages";

const supabase = createClient();

export type StoryOverlayPosition = "top" | "center" | "bottom";

// Canonical JSON shape of stories.text_overlay, written here and in the
// mobile createStory. Both viewers render it identically:
//   { "text": "...", "position": "top" | "center" | "bottom",
//     "size": "small" | "large" }
export interface StoryTextOverlay {
  text: string;
  position: StoryOverlayPosition;
  size: "small" | "large";
}

// Canonical JSON shape of stories.interactive_data. Kept as an object
// wrapper so later interactive elements (polls, questions) can sit beside
// stickers without a shape migration:
//   { "stickers": [ { "type": "mention" | "link", "value": "...",
//                     "position": "top" | "center" | "bottom" } ] }
// mention value is a username without the @; link value is an absolute URL.
export interface StorySticker {
  type: "mention" | "link";
  value: string;
  position: StoryOverlayPosition;
}

export interface StoryInteractiveData {
  stickers: StorySticker[];
}

export interface StoryWithAuthor {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  thumbnail_url: string | null;
  duration_seconds: number;
  interactive_data: StoryInteractiveData | null;
  text_overlay: StoryTextOverlay | null;
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
    interactiveData?: StoryInteractiveData;
    textOverlay?: StoryTextOverlay;
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
  // Get following list. Bounded so a huge follow graph can't blow up
  // every load; past this the ring needs a server-side join instead of
  // an IN list.
  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
    .limit(1000);

  const followingIds = following?.map((f) => f.following_id) || [];
  followingIds.push(userId); // Include own stories

  // Get active (non-expired) stories from followed users
  const { data: stories, error } = await supabase
    .from("stories")
    .select(
      `id, user_id, media_url, media_type, thumbnail_url, duration_seconds,
       interactive_data, text_overlay, visibility, view_count, expires_at,
       created_at,
       profiles!stories_user_id_fkey (id, username, display_name, avatar_url, is_verified)`
    )
    .in("user_id", followingIds)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) throw error;
  if (!stories || stories.length === 0) return [];

  // Through unknown: the literal-type query parser infers the to-one
  // profiles join as an array without generated DB types.
  let visibleStories = stories as unknown as StoryWithAuthor[];

  // Filter close_friends stories: only show if the viewer is in the
  // poster's close_friends list (same approach as getFeedPosts).
  const closeFriendsStories = visibleStories.filter(
    (s) => s.visibility === "close_friends" && s.user_id !== userId
  );

  if (closeFriendsStories.length > 0) {
    const posterIds = [...new Set(closeFriendsStories.map((s) => s.user_id))];
    const { data: cfData } = await supabase
      .from("close_friends")
      .select("user_id")
      .in("user_id", posterIds)
      .eq("friend_id", userId);

    const allowedPosterIds = new Set((cfData ?? []).map((cf) => cf.user_id));

    visibleStories = visibleStories.filter((s) => {
      if (s.visibility !== "close_friends") return true;
      if (s.user_id === userId) return true;
      return allowedPosterIds.has(s.user_id);
    });

    if (visibleStories.length === 0) return [];
  }

  // Get which stories the current user has already viewed
  const storyIds = visibleStories.map((s) => s.id);
  const { data: views } = await supabase
    .from("story_views")
    .select("story_id")
    .eq("viewer_id", userId)
    .in("story_id", storyIds);

  const viewedIds = new Set(views?.map((v) => v.story_id) || []);

  // Group by user
  const groupMap = new Map<string, StoryGroup>();

  for (const story of visibleStories) {
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

export interface StoryViewerRecord {
  viewer_id: string;
  viewed_at: string;
  profiles: StoryWithAuthor["profiles"];
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
  // Through unknown: same to-one join inference issue as above.
  return data as unknown as StoryViewerRecord[];
}

export async function deleteStory(storyId: string) {
  const { error } = await supabase
    .from("stories")
    .delete()
    .eq("id", storyId);

  if (error) throw error;
}

/**
 * React to someone's story: sends a DM to the author referencing the story
 * (messages have no metadata column, so the reference stays in the text)
 * and writes a story_reaction notification. No DB trigger produces
 * story_reaction, so the insert happens here; the notifications INSERT
 * policy allows it.
 */
export async function sendStoryReaction(
  story: Pick<StoryWithAuthor, "id" | "user_id">,
  reactorId: string,
  emoji: string
) {
  const conversationId = await getOrCreateDMConversation(
    reactorId,
    story.user_id
  );
  await sendMessage(
    conversationId,
    reactorId,
    `Reacted ${emoji} to your story`
  );

  const { error } = await supabase.from("notifications").insert({
    user_id: story.user_id,
    actor_id: reactorId,
    type: "story_reaction",
    entity_type: "story",
    entity_id: story.id,
    data: { emoji },
  });

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
