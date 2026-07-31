import { createClient } from "@/lib/supabase/client";
import type { ProfileSummary } from "@/lib/queries/social";
import type { RankingSignals } from "@/lib/services/feed-algorithm";

const supabase = createClient();

// ── Muted words ──────────────────────────────────────────────────────

export async function getMutedWords(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("muted_words")
    .select("word")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => row.word);
}

export async function addMutedWord(userId: string, word: string) {
  // Upsert with ignoreDuplicates so re-adding an existing word is a no-op
  // instead of a primary-key violation.
  const { error } = await supabase
    .from("muted_words")
    .upsert(
      { user_id: userId, word },
      { onConflict: "user_id,word", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function removeMutedWord(userId: string, word: string) {
  const { error } = await supabase
    .from("muted_words")
    .delete()
    .eq("user_id", userId)
    .eq("word", word);
  if (error) throw error;
}

/** Bulk import for the one-time migration of the legacy device-local list. */
export async function importMutedWords(userId: string, words: string[]) {
  if (words.length === 0) return;
  const rows = words.map((word) => ({ user_id: userId, word }));
  const { error } = await supabase
    .from("muted_words")
    .upsert(rows, { onConflict: "user_id,word", ignoreDuplicates: true });
  if (error) throw error;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive, word-boundary-ish matcher: "cat" hides "cat!" and
 * "CAT," but not "category". Multi-word phrases match as substrings with
 * the same boundary rule at each end.
 */
export function buildMutedWordMatcher(
  words: string[]
): (text: string | null) => boolean {
  if (words.length === 0) return () => false;
  const pattern = words.map(escapeRegex).join("|");
  const boundary = new RegExp(`(^|\\W)(${pattern})(\\W|$)`, "i");
  return (text) => !!text && boundary.test(text);
}

// ── Restricted accounts ──────────────────────────────────────────────

export async function restrictUser(userId: string, restrictedId: string) {
  const { error } = await supabase
    .from("restricted_users")
    .upsert(
      { user_id: userId, restricted_id: restrictedId },
      { onConflict: "user_id,restricted_id", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function unrestrictUser(userId: string, restrictedId: string) {
  const { error } = await supabase
    .from("restricted_users")
    .delete()
    .eq("user_id", userId)
    .eq("restricted_id", restrictedId);
  if (error) throw error;
}

export async function getRestrictedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("restricted_users")
    .select("restricted_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.restricted_id));
}

export async function getRestrictedProfiles(
  userId: string
): Promise<ProfileSummary[]> {
  const { data, error } = await supabase
    .from("restricted_users")
    .select("restricted_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = (data ?? []).map((row) => row.restricted_id);
  if (ids.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, bio, is_verified, follower_count, following_count"
    )
    .in("id", ids);
  if (profilesError) throw profilesError;

  // Keep the created_at desc order from the restriction rows.
  const byId = new Map(
    ((profiles ?? []) as ProfileSummary[]).map((p) => [p.id, p])
  );
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is ProfileSummary => p !== undefined);
}

// ── Not interested (post_feedback) ───────────────────────────────────

export async function markNotInterested(userId: string, postId: string) {
  const { error } = await supabase
    .from("post_feedback")
    .upsert(
      { user_id: userId, post_id: postId, feedback: "not_interested" },
      { onConflict: "user_id,post_id" }
    );
  if (error) throw error;
}

export async function getNotInterestedPostIds(
  userId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("post_feedback")
    .select("post_id")
    .eq("user_id", userId)
    .eq("feedback", "not_interested");
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.post_id));
}

// ── Ranking signals ──────────────────────────────────────────────────

const SIGNALS_TTL_MS = 5 * 60_000;

let signalsCache: {
  userId: string;
  fetchedAt: number;
  signals: RankingSignals;
} | null = null;

/**
 * The viewer's topic preferences and sensitivity setting for feed ranking.
 * Module-cached because the feed queryFn runs once per page; failures
 * degrade to neutral signals since ranking is decoration, not gating.
 */
export async function getRankingSignals(
  userId: string
): Promise<RankingSignals> {
  if (
    signalsCache &&
    signalsCache.userId === userId &&
    Date.now() - signalsCache.fetchedAt < SIGNALS_TTL_MS
  ) {
    return signalsCache.signals;
  }

  try {
    const [prefsResult, profileResult] = await Promise.all([
      supabase
        .from("content_preferences")
        .select("topic, preference")
        .eq("user_id", userId),
      supabase
        .from("profiles")
        .select("sensitive_content_level")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const prefs = prefsResult.data ?? [];
    const signals: RankingSignals = {
      seeMoreTopics: new Set(
        prefs
          .filter((p) => p.preference === "see_more")
          .map((p) => p.topic.toLowerCase())
      ),
      seeLessTopics: new Set(
        prefs
          .filter((p) => p.preference === "see_less")
          .map((p) => p.topic.toLowerCase())
      ),
      demoteSensitive: profileResult.data?.sensitive_content_level === "less",
    };

    if (!prefsResult.error && !profileResult.error) {
      signalsCache = { userId, fetchedAt: Date.now(), signals };
    }
    return signals;
  } catch {
    // A signals outage must never take the feed down with it.
    return {
      seeMoreTopics: new Set(),
      seeLessTopics: new Set(),
      demoteSensitive: false,
    };
  }
}
