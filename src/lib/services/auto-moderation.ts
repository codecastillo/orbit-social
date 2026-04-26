export interface ModerationResult {
  flagged: boolean;
  reason?: string;
  severity: "low" | "medium" | "high";
}

// Common profanity words (abbreviated list -- production would use a comprehensive list)
const PROFANITY_LIST = [
  "fuck", "shit", "ass", "bitch", "damn", "crap", "dick", "piss",
  "bastard", "cunt", "whore", "slut", "cock", "twat", "wanker",
];

// Harassment / threat patterns
const HARASSMENT_PATTERNS = [
  /\bi['']?ll\s+kill\s+you/i,
  /\byou\s+should\s+die/i,
  /\bkill\s+yourself/i,
  /\bgo\s+die/i,
  /\bi['']?m\s+going\s+to\s+(hurt|kill|destroy|end)\s+you/i,
  /\byou\s+deserve\s+to\s+die/i,
  /\bthreat(en)?\b.*\b(you|your|family)/i,
  /\bswat(ting)?\b/i,
  /\bdox(x)?(ing)?\b/i,
];

// Slur patterns (abbreviated)
const SLUR_PATTERNS = [
  /\bn[i1]gg[ae3]r?s?\b/i,
  /\bf[a4@]gg?[o0]t\b/i,
  /\br[e3]t[a4]rd(ed)?\b/i,
  /\btr[a4]nn(y|ie)/i,
  /\bk[i1]ke\b/i,
  /\bsp[i1]c\b/i,
  /\bch[i1]nk\b/i,
];

/**
 * Analyzes text content for potential policy violations.
 * Returns a moderation result with flagged status, reason, and severity.
 */
export function moderateContent(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { flagged: false, severity: "low" };
  }

  const normalizedText = text.toLowerCase();

  // Check for slurs (HIGH severity)
  for (const pattern of SLUR_PATTERNS) {
    if (pattern.test(text)) {
      return {
        flagged: true,
        reason: "Content contains slurs or hateful language",
        severity: "high",
      };
    }
  }

  // Check for harassment / threats (HIGH severity)
  for (const pattern of HARASSMENT_PATTERNS) {
    if (pattern.test(text)) {
      return {
        flagged: true,
        reason: "Content contains threats or harassment",
        severity: "high",
      };
    }
  }

  // Check for profanity (MEDIUM severity)
  const words = normalizedText.split(/\s+/);
  const profanityCount = words.filter((word) => {
    const cleaned = word.replace(/[^a-z]/g, "");
    return PROFANITY_LIST.includes(cleaned);
  }).length;

  if (profanityCount >= 3) {
    return {
      flagged: true,
      reason: "Content contains excessive profanity",
      severity: "medium",
    };
  }

  if (profanityCount >= 1) {
    return {
      flagged: true,
      reason: "Content contains profanity",
      severity: "low",
    };
  }

  // Spam detection: excessive caps
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 10) {
    const capsRatio = (text.replace(/[^A-Z]/g, "").length) / letters.length;
    if (capsRatio > 0.7) {
      return {
        flagged: true,
        reason: "Content appears to be spam (excessive capitalization)",
        severity: "medium",
      };
    }
  }

  // Spam detection: repeated characters (e.g., "hellooooooo")
  if (/(.)\1{5,}/i.test(text)) {
    return {
      flagged: true,
      reason: "Content appears to be spam (repeated characters)",
      severity: "low",
    };
  }

  // Spam detection: too many links
  const linkCount = (text.match(/https?:\/\//g) || []).length;
  if (linkCount >= 4) {
    return {
      flagged: true,
      reason: "Content appears to be spam (too many links)",
      severity: "medium",
    };
  }

  return { flagged: false, severity: "low" };
}

/**
 * Enhanced moderation: regex pre-filter + LLM check for borderline cases.
 *
 * Decision tree:
 *  - regex flagged HIGH severity → return regex result (skip LLM, save tokens)
 *  - regex clean and content is short/trivial (< 12 chars) → return regex result
 *  - otherwise → call LLM, return the more severe of the two results
 *
 * If the API endpoint is unreachable or returns an error, falls back to
 * regex-only — never blocks the user on AI failure.
 */
export async function moderateContentEnhanced(
  text: string
): Promise<ModerationResult> {
  const regexResult = moderateContent(text);

  // High-confidence regex flag — no need to consult LLM.
  if (regexResult.severity === "high" && regexResult.flagged) {
    return regexResult;
  }

  // Trivial content — skip the LLM.
  if (text.trim().length < 12) {
    return regexResult;
  }

  try {
    const res = await fetch("/api/moderation/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return regexResult;
    const llm = (await res.json()) as ModerationResult & { reason?: string };

    // Merge: take the more severe of the two.
    const severityOrder: Record<ModerationResult["severity"], number> = {
      low: 0,
      medium: 1,
      high: 2,
    };
    const llmIsMoreSevere =
      severityOrder[llm.severity] > severityOrder[regexResult.severity];

    if (llm.flagged && llmIsMoreSevere) return llm;
    if (regexResult.flagged) return regexResult;
    if (llm.flagged) return llm;
    return regexResult;
  } catch {
    return regexResult;
  }
}

/**
 * Flag content for admin review in the database.
 */
export async function flagContentForReview(
  postId: string,
  userId: string,
  reason: string,
  severity: string
) {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();

  const { error } = await supabase.from("content_flags").insert({
    post_id: postId,
    user_id: userId,
    reason,
    severity,
    auto_flagged: true,
  });

  if (error) throw error;
}
