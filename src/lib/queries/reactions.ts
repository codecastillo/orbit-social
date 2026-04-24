import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export type ReactionType = "love" | "fire" | "laugh" | "sad" | "wow" | "angry";

export interface ReactionCount {
  reaction_type: ReactionType;
  count: number;
}

export interface PostReaction {
  id: string;
  user_id: string;
  post_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

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

export async function addReaction(
  userId: string,
  postId: string,
  type: ReactionType
): Promise<PostReaction> {
  // Upsert: if user already reacted, update the type
  const { data, error } = await supabase
    .from("post_reactions")
    .upsert(
      { user_id: userId, post_id: postId, reaction_type: type },
      { onConflict: "user_id,post_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as PostReaction;
}

export async function removeReaction(
  userId: string,
  postId: string
): Promise<void> {
  const { error } = await supabase
    .from("post_reactions")
    .delete()
    .eq("user_id", userId)
    .eq("post_id", postId);

  if (error) throw error;
}

export async function getPostReactions(
  postId: string
): Promise<ReactionCount[]> {
  const { data, error } = await supabase
    .from("post_reactions")
    .select("reaction_type")
    .eq("post_id", postId);

  if (error) throw error;

  // Group by reaction_type and count
  const counts = new Map<ReactionType, number>();
  for (const row of data || []) {
    const rt = row.reaction_type as ReactionType;
    counts.set(rt, (counts.get(rt) || 0) + 1);
  }

  return Array.from(counts.entries()).map(([reaction_type, count]) => ({
    reaction_type,
    count,
  }));
}

export async function getUserReaction(
  userId: string,
  postId: string
): Promise<ReactionType | null> {
  const { data, error } = await supabase
    .from("post_reactions")
    .select("reaction_type")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (error) throw error;
  return (data?.reaction_type as ReactionType) ?? null;
}

export async function getPostsReactionCounts(
  postIds: string[]
): Promise<Map<string, ReactionCount[]>> {
  if (postIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("post_reactions")
    .select("post_id, reaction_type")
    .in("post_id", postIds);

  if (error) throw error;

  const result = new Map<string, Map<ReactionType, number>>();
  for (const row of data || []) {
    if (!result.has(row.post_id)) {
      result.set(row.post_id, new Map());
    }
    const counts = result.get(row.post_id)!;
    const rt = row.reaction_type as ReactionType;
    counts.set(rt, (counts.get(rt) || 0) + 1);
  }

  const finalResult = new Map<string, ReactionCount[]>();
  for (const [postId, counts] of result) {
    finalResult.set(
      postId,
      Array.from(counts.entries()).map(([reaction_type, count]) => ({
        reaction_type,
        count,
      }))
    );
  }

  return finalResult;
}

export async function getUserReactions(
  userId: string,
  postIds: string[]
): Promise<Map<string, ReactionType>> {
  if (postIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("post_reactions")
    .select("post_id, reaction_type")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (error) throw error;

  const result = new Map<string, ReactionType>();
  for (const row of data || []) {
    result.set(row.post_id, row.reaction_type as ReactionType);
  }

  return result;
}
