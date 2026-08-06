import { supabase } from "@/lib/supabase";
import { registerAccountScopedReset } from "@/lib/account-state";
import type { BlockedProfile } from "@/lib/queries/settings";

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
      { onConflict: "user_id,word", ignoreDuplicates: true },
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive, word-boundary-ish matcher: "cat" hides "cat!" and
 * "CAT," but not "category". Mirrors the web matcher in
 * src/lib/queries/content-safety.ts.
 */
export function buildMutedWordMatcher(
  words: string[],
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
      { onConflict: "user_id,restricted_id", ignoreDuplicates: true },
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
  userId: string,
): Promise<BlockedProfile[]> {
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
    .select("id, username, display_name, avatar_url")
    .in("id", ids);
  if (profilesError) throw profilesError;

  // Keep the created_at desc order from the restriction rows.
  const byId = new Map(
    ((profiles ?? []) as BlockedProfile[]).map((p) => [p.id, p]),
  );
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is BlockedProfile => p !== undefined);
}

// ── Not interested (post_feedback) ───────────────────────────────────

export type NotInterestedReason = "post" | "author" | "topic" | "format";

/**
 * Records that a post was dismissed, and why.
 *
 * The topic reason also writes a see_less preference for the tag, which is
 * what makes the promise checkable: "fewer posts like this" is a claim nobody
 * can verify, "fewer posts tagged #carguy" is a row someone can go and see in
 * their content settings.
 */
export async function markNotInterested(
  userId: string,
  postId: string,
  reason: NotInterestedReason = "post",
  topic?: string,
) {
  const { error } = await supabase
    .from("post_feedback")
    .upsert(
      { user_id: userId, post_id: postId, feedback: "not_interested", reason },
      { onConflict: "user_id,post_id" },
    );
  if (error) throw error;

  if (reason === "topic" && topic) {
    const { error: prefError } = await supabase
      .from("content_preferences")
      .upsert(
        { user_id: userId, topic: topic.toLowerCase(), preference: "see_less" },
        { onConflict: "user_id,topic" },
      );
    // The dismissal already succeeded; failing the whole call because the
    // preference did not save would hide the part that worked.
    if (prefError) console.warn("[feed] see_less not saved:", prefError);
  }
}

export async function getNotInterestedPostIds(
  userId: string,
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

/** Viewer signals from content_preferences and the profile sensitivity level. */
export interface RankingSignals {
  seeMoreTopics: Set<string>;
  seeLessTopics: Set<string>;
  demoteSensitive: boolean;
  // Level "more": content-warning gates skip the reveal tap for this viewer.
  autoRevealSensitive: boolean;
}

const SIGNALS_TTL_MS = 5 * 60_000;

let signalsCache: {
  userId: string;
  fetchedAt: number;
  signals: RankingSignals;
} | null = null;

registerAccountScopedReset(() => {
  signalsCache = null;
});

/**
 * The viewer's topic preferences and sensitivity setting for feed ranking.
 * Module-cached because the feed queryFn runs once per page; failures
 * degrade to neutral signals since ranking is decoration, not gating.
 */
export async function getRankingSignals(
  userId: string,
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
          .map((p) => p.topic.toLowerCase()),
      ),
      seeLessTopics: new Set(
        prefs
          .filter((p) => p.preference === "see_less")
          .map((p) => p.topic.toLowerCase()),
      ),
      demoteSensitive:
        (profileResult.data as { sensitive_content_level?: string } | null)
          ?.sensitive_content_level === "less",
      autoRevealSensitive:
        (profileResult.data as { sensitive_content_level?: string } | null)
          ?.sensitive_content_level === "more",
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
      autoRevealSensitive: false,
    };
  }
}
