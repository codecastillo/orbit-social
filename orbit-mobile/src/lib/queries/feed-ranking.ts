import { supabase } from "@/lib/supabase";

/**
 * Rollout gate for the server-side For You ranker (`feed_for_you`). Mirrors
 * the web src/lib/queries/feed-ranking.ts; mobile cannot import web code.
 *
 * The config row is world-readable and changes rarely, so it is fetched once
 * and reused for the rest of the session. Every failure path resolves to
 * "off": a viewer who cannot read the config keeps the chronological feed.
 */
export interface FeedRankingConfig {
  enabled: boolean;
  enabledPct: number;
  enabledFor: string[];
}

const RANKING_OFF: FeedRankingConfig = {
  enabled: false,
  enabledPct: 0,
  enabledFor: [],
};

// Long enough that a scroll session costs one request, short enough that
// flipping the flag in the database reaches clients without a new build.
const CONFIG_TTL_MS = 10 * 60 * 1000;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const BUCKET_COUNT = 100;

let cached: { config: FeedRankingConfig; fetchedAt: number } | null = null;
let inFlight: Promise<FeedRankingConfig> | null = null;

export async function getFeedRankingConfig(): Promise<FeedRankingConfig> {
  if (cached && Date.now() - cached.fetchedAt < CONFIG_TTL_MS) {
    return cached.config;
  }
  if (inFlight) return inFlight;

  const request = (async () => {
    let config = RANKING_OFF;
    try {
      const { data, error } = await supabase
        .from("feed_ranking_config")
        .select("enabled, enabled_pct, enabled_for")
        .maybeSingle();
      if (!error && data) {
        config = {
          enabled: data.enabled === true,
          enabledPct: data.enabled_pct ?? 0,
          enabledFor: data.enabled_for ?? [],
        };
      }
    } catch {
      // Offline or blocked: stay on the chronological feed.
    }
    // A failed read is cached too, so an outage cannot turn every feed page
    // into a retry of this query.
    cached = { config, fetchedAt: Date.now() };
    inFlight = null;
    return config;
  })();

  inFlight = request;
  return request;
}

/**
 * Stable rollout bucket (0-99) for a user id, FNV-1a over the uuid string.
 *
 * This deliberately does not reproduce Postgres `hashtext`: only the client
 * reads the bucket, so it needs to be stable per user across sessions and
 * evenly spread, not identical to any server-side hash.
 */
export function rolloutBucket(userId: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0) % BUCKET_COUNT;
}

export async function isRankingEnabled(userId: string): Promise<boolean> {
  const config = await getFeedRankingConfig();
  if (!config.enabled) return false;
  if (config.enabledFor.includes(userId)) return true;
  return rolloutBucket(userId) < config.enabledPct;
}
