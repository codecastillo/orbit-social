import { createClient } from "@/lib/supabase/client";

/** Surfaces the record_impressions RPC accepts; anything else is dropped server-side. */
export type ImpressionSurface =
  | "foryou"
  | "following"
  | "clips"
  | "profile"
  | "hashtag"
  | "search"
  | "detail";

/** Discrete engagement signals, mirroring the post_actions.action check. */
export type PostActionKind =
  | "profile_visit"
  | "link_click"
  | "share_dm"
  | "share_external"
  | "expand"
  | "rewatch";

export interface ImpressionInput {
  postId: string;
  surface: ImpressionSurface;
  /** Time the card spent qualified-visible, in ms. */
  dwellMs?: number;
  /** Media actually played, in ms. Clips only. */
  watchMs?: number;
  /** Duration of the media on the post, in ms. Clips only. */
  mediaMs?: number | null;
  completions?: number;
  views?: number;
}

interface QueuedImpression {
  post_id: string;
  surface: ImpressionSurface;
  views: number;
  dwell_ms: number;
  watch_ms: number;
  media_ms: number | null;
  completions: number;
  /** Local epoch ms of the newest exposure folded into this entry. */
  queued_at: number;
}

const STORAGE_KEY = "orbit:pending-impressions";
const FLUSH_AT_ENTRIES = 40;
const IDLE_FLUSH_MS = 15_000;
const MAX_STORED_ENTRIES = 500;
// The RPC stamps shown_date from the server clock, so a batch that sat
// through a day boundary would land on the wrong date. Drop it instead.
const MAX_RESTORE_AGE_MS = 24 * 60 * 60 * 1000;

const pending = new Map<string, QueuedImpression>();
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

/**
 * Queue one exposure. Repeat exposures of the same post merge locally so a
 * scroll up and back sends one row instead of two.
 *
 * Telemetry only: never throws, never blocks the caller.
 */
export function recordImpression(input: ImpressionInput): void {
  if (typeof window === "undefined") return;
  ensureRuntime();

  merge({
    post_id: input.postId,
    surface: input.surface,
    views: input.views ?? 1,
    dwell_ms: Math.max(0, Math.round(input.dwellMs ?? 0)),
    watch_ms: Math.max(0, Math.round(input.watchMs ?? 0)),
    media_ms:
      input.mediaMs === null || input.mediaMs === undefined
        ? null
        : Math.max(0, Math.round(input.mediaMs)),
    completions: input.completions ?? 0,
    queued_at: Date.now(),
  });

  if (pending.size >= FLUSH_AT_ENTRIES) {
    void flushImpressions();
    return;
  }
  armIdleFlush();
}

/**
 * Send everything queued. Safe to call at any time; a signed-out viewer
 * sends nothing and every failure is swallowed.
 */
export async function flushImpressions(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (pending.size === 0) return;

  const batch = [...pending.values()];
  // Persist before the request so a crash, an offline tab, or a rejected
  // call loses nothing: the next load restores this batch.
  persist(batch);
  pending.clear();

  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      clearStored();
      return;
    }

    const { error } = await supabase.rpc("record_impressions", {
      p_batch: batch.map(toRpcRow),
    });
    if (error) {
      requeue(batch);
      return;
    }
    clearStored();
  } catch {
    requeue(batch);
  }
}

/**
 * Log a discrete action on a post. Fire-and-forget, silent on every failure.
 */
export function recordAction(
  postId: string,
  action: PostActionKind,
  surface: ImpressionSurface,
): void {
  if (typeof window === "undefined") return;
  const supabase = createClient();
  void supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      if (!session) return;
      return supabase
        .from("post_actions")
        .insert({
          user_id: session.user.id,
          post_id: postId,
          action,
          surface,
        })
        .then(() => undefined);
    })
    .catch(() => {});
}

function merge(entry: QueuedImpression): void {
  const existing = pending.get(entry.post_id);
  if (!existing) {
    pending.set(entry.post_id, entry);
    return;
  }
  // The first surface wins, matching the RPC: its ON CONFLICT branch leaves
  // the stored surface alone, so overwriting here would only disagree.
  existing.views += entry.views;
  existing.dwell_ms += entry.dwell_ms;
  existing.watch_ms += entry.watch_ms;
  existing.completions += entry.completions;
  if (entry.media_ms !== null) existing.media_ms = entry.media_ms;
  existing.queued_at = Math.max(existing.queued_at, entry.queued_at);
}

function requeue(batch: QueuedImpression[]): void {
  for (const entry of batch) merge(entry);
  armIdleFlush();
}

function armIdleFlush(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void flushImpressions();
  }, IDLE_FLUSH_MS);
}

function toRpcRow(entry: QueuedImpression) {
  return {
    post_id: entry.post_id,
    surface: entry.surface,
    views: entry.views,
    dwell_ms: entry.dwell_ms,
    watch_ms: entry.watch_ms,
    media_ms: entry.media_ms,
    completions: entry.completions,
  };
}

function ensureRuntime(): void {
  if (initialized) return;
  initialized = true;
  restore();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushImpressions();
  });
  // pagehide rather than beforeunload: it also fires when the page goes
  // into the back/forward cache, which beforeunload does not.
  window.addEventListener("pagehide", () => {
    void flushImpressions();
  });
}

function restore(): void {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    clearStored();
    return;
  }
  if (!Array.isArray(stored)) {
    clearStored();
    return;
  }

  const cutoff = Date.now() - MAX_RESTORE_AGE_MS;
  let restored = 0;
  for (const entry of stored as QueuedImpression[]) {
    if (!entry?.post_id || !entry.surface) continue;
    if (!(entry.queued_at > cutoff)) continue;
    merge(entry);
    restored += 1;
  }
  clearStored();
  if (restored > 0) armIdleFlush();
}

function persist(batch: QueuedImpression[]): void {
  // Newest first so the cap drops the oldest exposures, which are also the
  // ones closest to aging out of the server's accepted window.
  const trimmed = [...batch]
    .sort((a, b) => b.queued_at - a.queued_at)
    .slice(0, MAX_STORED_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota or private-mode failures are not worth surfacing.
  }
}

function clearStored(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same silence as persist.
  }
}
