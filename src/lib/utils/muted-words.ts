// Pure matcher, no Supabase import: the push notify route runs it on the
// server, where pulling in the browser client from lib/queries would break.
// Client callers keep importing it via lib/queries/content-safety.

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
