export const LIVE_CATEGORIES = [
  { slug: "just-chatting", label: "Just Chatting", emoji: "💬", hue: 280 },
  { slug: "irl", label: "IRL", emoji: "🌎", hue: 145 },
  { slug: "gaming", label: "Gaming", emoji: "🎮", hue: 220 },
  { slug: "music", label: "Music", emoji: "🎵", hue: 340 },
  { slug: "art", label: "Art & Design", emoji: "🎨", hue: 18 },
  { slug: "cooking", label: "Cooking", emoji: "🍳", hue: 50 },
  { slug: "tech", label: "Tech & Coding", emoji: "💻", hue: 200 },
  { slug: "fitness", label: "Fitness", emoji: "💪", hue: 0 },
  { slug: "sports", label: "Sports", emoji: "⚽", hue: 90 },
  { slug: "education", label: "Education", emoji: "📚", hue: 260 },
  { slug: "podcasts", label: "Podcasts & Talk", emoji: "🎙️", hue: 30 },
  { slug: "asmr", label: "ASMR", emoji: "🎧", hue: 300 },
  { slug: "travel", label: "Travel", emoji: "✈️", hue: 195 },
  { slug: "fashion", label: "Fashion & Beauty", emoji: "💄", hue: 320 },
  { slug: "crypto", label: "Crypto & Markets", emoji: "₿", hue: 45 },
  { slug: "news", label: "News & Politics", emoji: "📰", hue: 0 },
  { slug: "comedy", label: "Comedy", emoji: "🤣", hue: 55 },
  { slug: "writing", label: "Writing", emoji: "✍️", hue: 250 },
  { slug: "spirituality", label: "Spirituality", emoji: "🧘", hue: 165 },
  { slug: "pets", label: "Pets & Animals", emoji: "🐾", hue: 35 },
  { slug: "cars", label: "Cars & Motorsports", emoji: "🏎️", hue: 0 },
  { slug: "outdoors", label: "Outdoors", emoji: "🏔️", hue: 130 },
  { slug: "dance", label: "Dance", emoji: "💃", hue: 310 },
  { slug: "diy", label: "DIY & Crafts", emoji: "🔨", hue: 22 },
  { slug: "other", label: "Other", emoji: "✨", hue: 240 },
] as const;

export type LiveCategorySlug = (typeof LIVE_CATEGORIES)[number]["slug"];

export const LIVE_CATEGORY_SLUGS: readonly LiveCategorySlug[] = LIVE_CATEGORIES.map(
  (c) => c.slug,
);

export function isLiveCategorySlug(value: unknown): value is LiveCategorySlug {
  return typeof value === "string" && (LIVE_CATEGORY_SLUGS as readonly string[]).includes(value);
}

export const LIVE_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
] as const;

export type LiveLanguageCode = (typeof LIVE_LANGUAGES)[number]["code"];

export const LIVE_LANGUAGE_CODES: readonly LiveLanguageCode[] = LIVE_LANGUAGES.map(
  (l) => l.code,
);

export function isLiveLanguageCode(value: unknown): value is LiveLanguageCode {
  return typeof value === "string" && (LIVE_LANGUAGE_CODES as readonly string[]).includes(value);
}

export const LIVE_SLOW_MODE_OPTIONS = [0, 5, 10, 30, 60] as const;
export type LiveSlowModeSeconds = (typeof LIVE_SLOW_MODE_OPTIONS)[number];

export function isLiveSlowModeValue(value: unknown): value is LiveSlowModeSeconds {
  return typeof value === "number" && (LIVE_SLOW_MODE_OPTIONS as readonly number[]).includes(value);
}
