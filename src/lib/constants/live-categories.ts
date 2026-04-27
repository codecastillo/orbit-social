export const LIVE_CATEGORIES = [
  { slug: "just-chatting", label: "Just Chatting", emoji: "💬", iconName: "MessageCircle", hue: 280 },
  { slug: "irl", label: "IRL", emoji: "🌎", iconName: "Camera", hue: 145 },
  { slug: "gaming", label: "Gaming", emoji: "🎮", iconName: "Gamepad2", hue: 220 },
  { slug: "music", label: "Music", emoji: "🎵", iconName: "Music2", hue: 340 },
  { slug: "art", label: "Art & Design", emoji: "🎨", iconName: "Palette", hue: 18 },
  { slug: "cooking", label: "Cooking", emoji: "🍳", iconName: "Utensils", hue: 50 },
  { slug: "tech", label: "Tech & Coding", emoji: "💻", iconName: "Code", hue: 200 },
  { slug: "fitness", label: "Fitness", emoji: "💪", iconName: "Dumbbell", hue: 0 },
  { slug: "sports", label: "Sports", emoji: "⚽", iconName: "Trophy", hue: 90 },
  { slug: "education", label: "Education", emoji: "📚", iconName: "GraduationCap", hue: 260 },
  { slug: "podcasts", label: "Podcasts & Talk", emoji: "🎙️", iconName: "Mic", hue: 30 },
  { slug: "asmr", label: "ASMR", emoji: "🎧", iconName: "Headphones", hue: 300 },
  { slug: "travel", label: "Travel", emoji: "✈️", iconName: "Plane", hue: 195 },
  { slug: "fashion", label: "Fashion & Beauty", emoji: "💄", iconName: "Sparkles", hue: 320 },
  { slug: "crypto", label: "Crypto & Markets", emoji: "₿", iconName: "Bitcoin", hue: 45 },
  { slug: "news", label: "News & Politics", emoji: "📰", iconName: "Newspaper", hue: 0 },
  { slug: "comedy", label: "Comedy", emoji: "🤣", iconName: "Laugh", hue: 55 },
  { slug: "writing", label: "Writing", emoji: "✍️", iconName: "PenLine", hue: 250 },
  { slug: "spirituality", label: "Spirituality", emoji: "🧘", iconName: "Flame", hue: 165 },
  { slug: "pets", label: "Pets & Animals", emoji: "🐾", iconName: "PawPrint", hue: 35 },
  { slug: "cars", label: "Cars & Motorsports", emoji: "🏎️", iconName: "Car", hue: 0 },
  { slug: "outdoors", label: "Outdoors", emoji: "🏔️", iconName: "Mountain", hue: 130 },
  { slug: "dance", label: "Dance", emoji: "💃", iconName: "Music", hue: 310 },
  { slug: "diy", label: "DIY & Crafts", emoji: "🔨", iconName: "Hammer", hue: 22 },
  { slug: "other", label: "Other", emoji: "✨", iconName: "Sparkles", hue: 240 },
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
