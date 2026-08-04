import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { registerAccountScopedReset } from "@/lib/account-state";
import { supabase } from "@/lib/supabase";

/**
 * Where the viewer saw the post. Same seven values the record_impressions
 * RPC and post_actions accept, and the same set the web queue uses.
 */
export type ImpressionSurface =
  | "foryou"
  | "following"
  | "clips"
  | "profile"
  | "hashtag"
  | "search"
  | "detail";

/** Deliberate interactions worth more than an exposure. */
export type PostAction =
  | "profile_visit"
  | "link_click"
  | "share_dm"
  | "share_external"
  | "expand"
  | "rewatch";

export interface ImpressionMetrics {
  /** Exposures to add. Defaults to 1; pass 0 to add time to an existing row. */
  views?: number;
  /** Time the post was on screen. */
  dwellMs?: number;
  /** Time its video actually played. */
  watchMs?: number;
  /** Length of the media itself, so watch time can be read as a ratio. */
  mediaMs?: number;
  completions?: number;
}

interface PendingImpression {
  postId: string;
  surface: ImpressionSurface;
  views: number;
  dwellMs: number;
  watchMs: number;
  mediaMs: number;
  completions: number;
  queuedAt: number;
}

const STORAGE_KEY = "orbit-pending-impressions";
const FLUSH_AT_PENDING = 40;
const IDLE_FLUSH_MS = 15_000;
// Older than this and the day bucket the server would upsert into is wrong
// anyway, so a queue that survived a long offline stretch is dropped.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_PERSISTED = 500;

// Keyed by post id: seeing the same post twice in one session is one row on
// the server (viewer, post, day), so it is one entry here too.
const pending = new Map<string, PendingImpression>();

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: { remove: () => void } | null = null;
let restore: Promise<void> | null = null;
let flush: Promise<void> = Promise.resolve();
// Bumped on account switch. A flush that started under the outgoing account
// must not land after the incoming one's token is in place.
let accountGeneration = 0;

/**
 * Queues an exposure. Cheap and synchronous: it merges into the in-memory
 * map and returns, so it is safe to call from a scroll callback or a video
 * tick. Nothing here can throw, and nothing reaches the network until a
 * flush trigger fires.
 */
export function recordImpression(
  postId: string,
  surface: ImpressionSurface,
  metrics: ImpressionMetrics = {},
): void {
  if (!postId) return;
  start();

  const entry = pending.get(postId) ?? {
    postId,
    surface,
    views: 0,
    dwellMs: 0,
    watchMs: 0,
    mediaMs: 0,
    completions: 0,
    queuedAt: Date.now(),
  };
  // Last surface wins: the row carries one, and the most recent place the
  // viewer met the post is the one worth attributing it to.
  entry.surface = surface;
  entry.views += metrics.views ?? 1;
  entry.dwellMs += metrics.dwellMs ?? 0;
  entry.watchMs += metrics.watchMs ?? 0;
  // Media length is a property of the post, not time spent, so repeat
  // exposures take the largest reading instead of stacking.
  entry.mediaMs = Math.max(entry.mediaMs, metrics.mediaMs ?? 0);
  entry.completions += metrics.completions ?? 0;
  pending.set(postId, entry);

  if (pending.size >= FLUSH_AT_PENDING) {
    void flushImpressions();
    return;
  }
  scheduleIdleFlush();
}

/**
 * Ships whatever is queued. Screens call this on unmount; the queue also
 * calls it itself at 40 entries, after 15s of quiet, and when the app leaves
 * the foreground. Resolves when the attempt is over, never rejects.
 */
export function flushImpressions(): Promise<void> {
  // Serialized so two triggers cannot send the same entries twice, and
  // terminated with a catch so a caller never inherits a rejection.
  flush = flush.then(runFlush, runFlush).catch(() => {});
  return flush;
}

/**
 * Records a deliberate interaction. Fire and forget, like recordImpression:
 * these are rare enough that batching them would only delay the signal.
 */
export function recordAction(
  postId: string,
  action: PostAction,
  surface: ImpressionSurface,
): void {
  if (!postId) return;
  void (async () => {
    try {
      const viewerId = await currentViewerId();
      if (!viewerId) return;
      await supabase
        .from("post_actions")
        .insert({ user_id: viewerId, post_id: postId, action, surface });
    } catch {
      // Instrumentation is invisible by contract: a lost action is worth
      // less than anything a user would see going wrong because of it.
    }
  })();
}

// The queue only wakes up once something is actually being recorded, so a
// signed-out launch costs no listener and no storage read.
function start(): void {
  restore ??= restorePending();
  appStateSub ??= AppState.addEventListener("change", (status) => {
    // JS timers stall while the app is backgrounded, and the process can be
    // reaped without waking again, so ship on the way out.
    if (status !== "active") void flushImpressions();
  });
}

function scheduleIdleFlush(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void flushImpressions();
  }, IDLE_FLUSH_MS);
}

async function runFlush(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  // Fold anything a previous launch left behind in before deciding there is
  // nothing to send.
  if (restore) await restore;
  if (pending.size === 0) return;

  const generation = accountGeneration;
  const viewerId = await currentViewerId();
  if (!viewerId || generation !== accountGeneration) {
    // Signed out, or an account switch landed mid-flush. Either way this
    // batch has no owner it can honestly be attributed to.
    pending.clear();
    await clearStored();
    return;
  }

  const batch = newestFirst([...pending.values()]).slice(0, MAX_PERSISTED);
  pending.clear();
  // Persisted before the request, not after: a crash between the two costs
  // a retry next launch, while the other order would lose the batch.
  await store(viewerId, batch);

  try {
    const { error } = await supabase.rpc("record_impressions", {
      p_batch: batch.map(toRow),
    });
    if (error) {
      requeue(batch);
      return;
    }
  } catch {
    requeue(batch);
    return;
  }
  await clearStored();
}

/** Puts a failed batch back so the next trigger retries it. */
function requeue(batch: PendingImpression[]): void {
  for (const entry of batch) {
    const current = pending.get(entry.postId);
    if (!current) {
      pending.set(entry.postId, entry);
      continue;
    }
    current.views += entry.views;
    current.dwellMs += entry.dwellMs;
    current.watchMs += entry.watchMs;
    current.mediaMs = Math.max(current.mediaMs, entry.mediaMs);
    current.completions += entry.completions;
    current.queuedAt = Math.min(current.queuedAt, entry.queuedAt);
  }
}

function toRow(entry: PendingImpression) {
  return {
    post_id: entry.postId,
    surface: entry.surface,
    views: entry.views,
    dwell_ms: Math.round(entry.dwellMs),
    watch_ms: Math.round(entry.watchMs),
    media_ms: Math.round(entry.mediaMs),
    completions: entry.completions,
  };
}

function newestFirst(entries: PendingImpression[]): PendingImpression[] {
  return entries.sort((a, b) => b.queuedAt - a.queuedAt);
}

async function currentViewerId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    // No session means nothing to attribute the batch to, same as signed out.
    return null;
  }
}

async function store(
  viewerId: string,
  entries: PendingImpression[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ viewerId, entries }),
    );
  } catch {
    // The batch is still in flight; losing the crash-safety copy is the
    // smaller failure.
  }
}

async function clearStored(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // A stale blob is discarded on the next restore anyway.
  }
}

async function restorePending(): Promise<void> {
  let stored: { viewerId?: unknown; entries?: unknown } | null = null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    stored = raw ? (JSON.parse(raw) as { viewerId?: unknown; entries?: unknown }) : null;
  } catch {
    // Corrupt or unreadable store; instrumentation starts fresh.
    return;
  }
  if (!stored || !Array.isArray(stored.entries)) return;

  // The blob belongs to whoever queued it. Replaying it under a different
  // account would attribute one person's reading to another.
  if (stored.viewerId !== (await currentViewerId())) {
    await clearStored();
    return;
  }

  const cutoff = Date.now() - MAX_AGE_MS;
  const fresh = newestFirst(
    stored.entries.filter(isPendingImpression).filter((e) => e.queuedAt >= cutoff),
  ).slice(0, MAX_PERSISTED);
  requeue(fresh);
}

function isPendingImpression(value: unknown): value is PendingImpression {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.postId === "string" &&
    entry.postId.length > 0 &&
    typeof entry.surface === "string" &&
    typeof entry.views === "number" &&
    typeof entry.dwellMs === "number" &&
    typeof entry.watchMs === "number" &&
    typeof entry.mediaMs === "number" &&
    typeof entry.completions === "number" &&
    typeof entry.queuedAt === "number"
  );
}

// A switch drops the queue instead of flushing it. The RPC is SECURITY
// INVOKER, so a flush racing the swap would write the outgoing account's
// reading under the incoming account's token. The stored copy goes with it.
registerAccountScopedReset(() => {
  accountGeneration += 1;
  pending.clear();
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  // A restore already in flight belongs to the outgoing account too; the
  // next record starts a fresh one against the incoming session.
  restore = null;
  void clearStored();
});
