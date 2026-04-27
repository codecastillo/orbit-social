export const LIVE_GAMES = [
  { slug: "valorant", label: "VALORANT", category: "gaming", accentHue: 0 },
  { slug: "minecraft", label: "Minecraft", category: "gaming", accentHue: 130 },
  { slug: "fortnite", label: "Fortnite", category: "gaming", accentHue: 270 },
  { slug: "gta-v", label: "Grand Theft Auto V", category: "gaming", accentHue: 200 },
  { slug: "cod-warzone", label: "Call of Duty: Warzone", category: "gaming", accentHue: 30 },
  { slug: "cod-mw3", label: "Call of Duty: MWIII", category: "gaming", accentHue: 25 },
  { slug: "apex-legends", label: "Apex Legends", category: "gaming", accentHue: 5 },
  { slug: "lol", label: "League of Legends", category: "gaming", accentHue: 220 },
  { slug: "cs2", label: "Counter-Strike 2", category: "gaming", accentHue: 45 },
  { slug: "overwatch-2", label: "Overwatch 2", category: "gaming", accentHue: 35 },
  { slug: "marvel-rivals", label: "Marvel Rivals", category: "gaming", accentHue: 350 },
  { slug: "roblox", label: "Roblox", category: "gaming", accentHue: 0 },
  { slug: "free-fire", label: "Garena Free Fire", category: "gaming", accentHue: 20 },
  { slug: "pubg", label: "PUBG: Battlegrounds", category: "gaming", accentHue: 50 },
  { slug: "rocket-league", label: "Rocket League", category: "gaming", accentHue: 195 },
  { slug: "fc-25", label: "EA Sports FC 25", category: "gaming", accentHue: 145 },
  { slug: "dota-2", label: "Dota 2", category: "gaming", accentHue: 0 },
  { slug: "rust", label: "Rust", category: "gaming", accentHue: 18 },
  { slug: "wow", label: "World of Warcraft", category: "gaming", accentHue: 50 },
  { slug: "elden-ring", label: "Elden Ring", category: "gaming", accentHue: 45 },
  { slug: "hearthstone", label: "Hearthstone", category: "gaming", accentHue: 220 },
  { slug: "tarkov", label: "Escape From Tarkov", category: "gaming", accentHue: 95 },
  { slug: "sims-4", label: "The Sims 4", category: "gaming", accentHue: 145 },
  { slug: "pokemon", label: "Pokémon", category: "gaming", accentHue: 50 },
  { slug: "chess", label: "Chess", category: "gaming", accentHue: 0 },
] as const;

export type LiveGame = (typeof LIVE_GAMES)[number];
export type LiveGameSlug = LiveGame["slug"];

export const LIVE_GAMES_BY_SLUG: Record<LiveGameSlug, LiveGame> = Object.fromEntries(
  LIVE_GAMES.map((g) => [g.slug, g]),
) as Record<LiveGameSlug, LiveGame>;

export function isLiveGameSlug(s: string): s is LiveGameSlug {
  return Object.prototype.hasOwnProperty.call(LIVE_GAMES_BY_SLUG, s);
}

function boxArt(label: string, size: string): string {
  return `https://static-cdn.jtvnw.net/ttv-boxart/${encodeURIComponent(label)}-${size}.jpg`;
}

export function coverArtUrl(slug: string): string {
  if (!isLiveGameSlug(slug)) return "";
  return boxArt(LIVE_GAMES_BY_SLUG[slug].label, "285x380");
}

export function coverArtSmallUrl(slug: string): string {
  if (!isLiveGameSlug(slug)) return "";
  return boxArt(LIVE_GAMES_BY_SLUG[slug].label, "144x192");
}
