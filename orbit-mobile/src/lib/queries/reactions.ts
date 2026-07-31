import { supabase } from "@/lib/supabase";

export type ReactionType = "love" | "fire" | "laugh" | "sad" | "wow" | "angry";

export interface ReactionCount {
  reaction_type: ReactionType;
  count: number;
}

export const REACTION_TYPES: ReactionType[] = ["love", "fire", "laugh", "sad", "wow", "angry"];

// Same glyph set the web REACTION_EMOJI uses; these are reaction data,
// not copy, and stay as escapes to match the web source byte for byte.
export const REACTION_EMOJI: Record<ReactionType, string> = {
  love: "\u2764\uFE0F",
  fire: "\uD83D\uDD25",
  laugh: "\uD83D\uDE02",
  sad: "\uD83D\uDE22",
  wow: "\uD83D\uDE2E",
  angry: "\uD83D\uDE21",
};

export const REACTION_LABELS: Record<ReactionType, string> = {
  love: "Love",
  fire: "Fire",
  laugh: "Laugh",
  sad: "Sad",
  wow: "Wow",
  angry: "Angry",
};

// Upsert on (user_id, post_id): reacting again with a different type
// replaces the previous reaction instead of stacking a second row.
export async function addReaction(userId: string, postId: string, type: ReactionType) {
  const { error } = await supabase
    .from("post_reactions")
    .upsert(
      { user_id: userId, post_id: postId, reaction_type: type },
      { onConflict: "user_id,post_id" },
    );

  if (error) throw error;
}

export async function removeReaction(userId: string, postId: string) {
  const { error } = await supabase
    .from("post_reactions")
    .delete()
    .eq("user_id", userId)
    .eq("post_id", postId);

  if (error) throw error;
}

// Batched per feed page so the list issues one reactions query per page
// instead of one per card. Mirrors the web getPostsReactionCounts.
export async function getPostsReactionCounts(
  postIds: string[],
): Promise<Map<string, ReactionCount[]>> {
  if (postIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("post_reactions")
    .select("post_id, reaction_type")
    .in("post_id", postIds);

  if (error) throw error;

  const grouped = new Map<string, Map<ReactionType, number>>();
  for (const row of data ?? []) {
    let counts = grouped.get(row.post_id);
    if (!counts) {
      counts = new Map();
      grouped.set(row.post_id, counts);
    }
    const type = row.reaction_type as ReactionType;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  const result = new Map<string, ReactionCount[]>();
  for (const [postId, counts] of grouped) {
    result.set(
      postId,
      Array.from(counts.entries()).map(([reaction_type, count]) => ({ reaction_type, count })),
    );
  }
  return result;
}

// The viewer's own reaction per post, batched the same way.
export async function getUserReactions(
  userId: string,
  postIds: string[],
): Promise<Map<string, ReactionType>> {
  if (postIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("post_reactions")
    .select("post_id, reaction_type")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (error) throw error;

  const result = new Map<string, ReactionType>();
  for (const row of data ?? []) {
    result.set(row.post_id, row.reaction_type as ReactionType);
  }
  return result;
}
