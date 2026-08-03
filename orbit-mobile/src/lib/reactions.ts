import AsyncStorage from "@react-native-async-storage/async-storage";

// Shared emoji-reaction constants for posts, comments, DMs, and stories.
// Query helpers stay in src/lib/queries/reactions.ts; this module is pure
// constants and device-local state so components can import it without
// dragging in supabase.

// The six quick-row glyphs, identical to the web MESSAGE_REACTIONS set so
// both clients group reactions on the same strings. User-picked reaction
// emoji are user content, not UI chrome; kept as escapes to match the web
// source byte for byte.
export const REACTION_QUICK_ROW = [
  { emoji: "\u2764\uFE0F", label: "Love" },
  { emoji: "\uD83D\uDC4D", label: "Thumbs Up" },
  { emoji: "\uD83D\uDE02", label: "Laugh" },
  { emoji: "\uD83D\uDE2E", label: "Wow" },
  { emoji: "\uD83D\uDE22", label: "Sad" },
  { emoji: "\uD83D\uDD25", label: "Fire" },
] as const;

// Curated 32-glyph grid, copied verbatim from the web's
// src/lib/reactions/emoji.ts so both pickers offer the identical set in
// the identical order and reactions group across clients. Anything else
// goes through the sheet's free-text input instead of bloating the grid.
export const EMOJI_GRID = [
  "\uD83D\uDE00", // grinning
  "\uD83D\uDE02", // tears of joy
  "\uD83E\uDD23", // rofl
  "\uD83D\uDE0A", // smiling
  "\uD83D\uDE0D", // heart eyes
  "\uD83E\uDD70", // smiling with hearts
  "\uD83D\uDE18", // blowing kiss
  "\uD83D\uDE0E", // sunglasses
  "\uD83E\uDD14", // thinking
  "\uD83D\uDE05", // sweat smile
  "\uD83D\uDE2D", // loudly crying
  "\uD83D\uDE2E", // open mouth
  "\uD83D\uDE24", // steam nose
  "\uD83D\uDE21", // angry
  "\uD83E\uDD73", // partying
  "\uD83D\uDE34", // sleeping
  "\uD83E\uDD2F", // mind blown
  "\uD83D\uDC80", // skull
  "\u2764\uFE0F", // red heart
  "\uD83D\uDC94", // broken heart
  "\uD83D\uDC95", // two hearts
  "\uD83D\uDC96", // sparkling heart
  "\uD83D\uDC4D", // thumbs up
  "\uD83D\uDC4E", // thumbs down
  "\uD83D\uDC4F", // clap
  "\uD83D\uDE4C", // raised hands
  "\uD83D\uDE4F", // folded hands
  "\uD83D\uDCAA", // flexed biceps
  "\uD83D\uDD25", // fire
  "\u2728", // sparkles
  "\uD83C\uDF89", // party popper
  "\uD83D\uDCAF", // hundred
] as const;

// Reaction names stored before reaction_type became free text. The backfill
// rewrote them to glyphs, but cached pages and any row it missed still need
// this fallback. Same map as the web LEGACY_REACTION_GLYPHS.
const LEGACY_REACTION_GLYPHS: Record<string, string> = {
  love: "\u2764\uFE0F",
  fire: "\uD83D\uDD25",
  laugh: "\uD83D\uDE02",
  sad: "\uD83D\uDE22",
  wow: "\uD83D\uDE2E",
  angry: "\uD83D\uDE21",
};

// Renders a stored reaction_type: the glyph itself, or the legacy name's
// glyph for an un-backfilled row.
export function resolveReactionGlyph(value: string): string {
  return LEGACY_REACTION_GLYPHS[value] ?? value;
}

// One emoji grapheme: a pictographic base plus optional variation selector,
// skin tone, and ZWJ-joined continuations. Hermes supports \p{...} property
// escapes under the u flag. The single implementation for every reaction
// input in the app.
const SINGLE_EMOJI_RE =
  /^\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])*)*$/u;

// The 16-char cap mirrors the length CHECK on post_reactions.reaction_type
// and message_reactions.emoji, same as the web isSingleEmoji.
const MAX_REACTION_LENGTH = 16;

export function isSingleEmoji(text: string): boolean {
  return (
    text.length > 0 &&
    text.length <= MAX_REACTION_LENGTH &&
    SINGLE_EMOJI_RE.test(text)
  );
}

const RECENTS_KEY = "orbit-reaction-recents";
export const MAX_RECENT_EMOJI = 8;

export async function getRecentEmoji(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed)
      ? parsed.filter((e): e is string => typeof e === "string")
      : [];
  } catch {
    // Corrupt or unreadable store; recents are a convenience, start fresh.
    return [];
  }
}

// Most recent first, deduplicated, capped at MAX_RECENT_EMOJI.
export async function addRecentEmoji(emoji: string): Promise<void> {
  const current = await getRecentEmoji();
  const next = [emoji, ...current.filter((e) => e !== emoji)].slice(
    0,
    MAX_RECENT_EMOJI,
  );
  try {
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // A failed write only loses the recents ordering.
  }
}
