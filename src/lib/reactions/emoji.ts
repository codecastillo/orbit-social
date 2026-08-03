// Shared emoji sets for the feed, DM, and story reaction pickers.
// Every glyph in this file is user-picked reaction content, not UI chrome,
// so the no-emoji copy rule does not apply here. Glyphs are written as
// unicode escapes to keep raw emoji out of source.

export interface QuickReaction {
  emoji: string;
  label: string;
}

// Six-slot quick row, the same set the DMs have always offered.
export const REACTION_QUICK_ROW: QuickReaction[] = [
  { emoji: "\u2764\uFE0F", label: "Love" },
  { emoji: "\uD83D\uDC4D", label: "Thumbs Up" },
  { emoji: "\uD83D\uDE02", label: "Laugh" },
  { emoji: "\uD83D\uDE2E", label: "Wow" },
  { emoji: "\uD83D\uDE22", label: "Sad" },
  { emoji: "\uD83D\uDD25", label: "Fire" },
];

// Curated 32-glyph grid: smileys, hearts, hands, symbols. Anything else
// goes through the picker's free-text input instead of bloating the grid.
export const EMOJI_GRID: string[] = [
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
];

// Legacy reaction_type names that predate the free-text emoji column.
// Backfilled server-side, but any straggler row still renders via this map.
export const LEGACY_REACTION_GLYPHS: Record<string, string> = {
  love: "\u2764\uFE0F",
  fire: "\uD83D\uDD25",
  laugh: "\uD83D\uDE02",
  sad: "\uD83D\uDE22",
  wow: "\uD83D\uDE2E",
  angry: "\uD83D\uDE21",
};

export function resolveReactionGlyph(value: string): string {
  return LEGACY_REACTION_GLYPHS[value] ?? value;
}

// One emoji grapheme: a pictographic base, optionally followed by VS16 or a
// skin tone, joined into a sequence with ZWJ (family, couple, etc.).
const EMOJI_UNIT =
  "\\p{Extended_Pictographic}(?:\\uFE0F|[\\u{1F3FB}-\\u{1F3FF}])*";
const SINGLE_EMOJI_RE = new RegExp(
  `^${EMOJI_UNIT}(?:\\u200D${EMOJI_UNIT})*$`,
  "u"
);

// The 16-char cap mirrors the length CHECK on post_reactions.reaction_type
// and message_reactions.emoji.
const MAX_REACTION_LENGTH = 16;

export function isSingleEmoji(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_REACTION_LENGTH &&
    SINGLE_EMOJI_RE.test(value)
  );
}

const RECENTS_KEY = "orbit:reaction-recents";
export const MAX_RECENT_EMOJI = 8;

export function getRecentEmoji(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter((e): e is string => typeof e === "string")
          .slice(0, MAX_RECENT_EMOJI)
      : [];
  } catch {
    return [];
  }
}

export function pushRecentEmoji(emoji: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = [emoji, ...getRecentEmoji().filter((e) => e !== emoji)].slice(
      0,
      MAX_RECENT_EMOJI
    );
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked; recents are a convenience, not state.
  }
}
