import { supabase } from "@/lib/supabase";

/**
 * Below this age the counterpart reads as online rather than "Active Xm ago".
 * Deliberately more than double HEARTBEAT_MS: a client that is online writes
 * only once per heartbeat, so an equal window marks a genuinely active user
 * offline in the seconds before each write and the dot blinks. Two missed
 * beats are now needed before the dot drops.
 */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/** Cadence for touch_last_seen. One write per window at most, per client. */
export const HEARTBEAT_MS = 2 * 60 * 1000;

/** How often a presence display refreshes while a screen is open. */
export const PRESENCE_REFRESH_MS = 60 * 1000;

/** Past this, "last active" stops being useful and nothing is shown. */
const PRESENCE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface Presence {
  /** Active within ONLINE_WINDOW_MS, so surfaces render the green dot. */
  online: boolean;
  label: string;
}

/**
 * Whether the user hides their activity status. Gates both directions:
 * hiding yours also hides everyone else's from you, the same reciprocal
 * contract read receipts use (see getDmSeenAt). Mirrors
 * src/lib/queries/presence.ts on web.
 */
export async function getHideActivity(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("hide_activity")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return (data as { hide_activity?: boolean }).hide_activity ?? false;
}

export async function setHideActivity(
  userId: string,
  hidden: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ hide_activity: hidden })
    .eq("id", userId);

  if (error) throw error;
}

/** Bump the caller's own last_seen_at. Never call while hide_activity is on. */
export async function touchLastSeen(): Promise<void> {
  const { error } = await supabase.rpc("touch_last_seen");
  if (error) throw error;
}

/**
 * The target's last activity as this viewer may see it. Null when the viewer
 * hides their own activity (reciprocal), when the target hides theirs (the
 * RPC returns null for them), or when the target has never been seen.
 */
export async function getVisibleLastSeen(
  targetId: string,
  viewerId: string,
): Promise<string | null> {
  if (await getHideActivity(viewerId)) return null;

  const { data, error } = await supabase.rpc("get_visible_last_seen", {
    target_id: targetId,
  });
  if (error) return null;
  return (data as string | null) ?? null;
}

/**
 * Presence for several people at once, for the conversations list. The RPC
 * takes one target per call, so this fans out; the viewer's own hide check
 * runs once and short-circuits the whole batch.
 */
export async function getVisibleLastSeenMany(
  targetIds: string[],
  viewerId: string,
): Promise<Map<string, string>> {
  const seen = new Map<string, string>();
  if (targetIds.length === 0) return seen;
  if (await getHideActivity(viewerId)) return seen;

  const results = await Promise.all(
    targetIds.map(async (id) => {
      const { data, error } = await supabase.rpc("get_visible_last_seen", {
        target_id: id,
      });
      return [id, error ? null : ((data as string | null) ?? null)] as const;
    }),
  );
  for (const [id, lastSeen] of results) {
    if (lastSeen) seen.set(id, lastSeen);
  }
  return seen;
}

/** Turn a last_seen timestamp into the dot plus label, or null to show nothing. */
export function presenceOf(
  lastSeenAt: string | null | undefined,
): Presence | null {
  if (!lastSeenAt) return null;
  const age = Date.now() - new Date(lastSeenAt).getTime();
  if (age < ONLINE_WINDOW_MS) return { online: true, label: "Active now" };
  if (age >= PRESENCE_STALE_MS) return null;

  if (age < HOUR_MS) {
    return {
      online: false,
      label: `Active ${Math.floor(age / MINUTE_MS)}m ago`,
    };
  }
  if (age < DAY_MS) {
    return { online: false, label: `Active ${Math.floor(age / HOUR_MS)}h ago` };
  }
  return { online: false, label: `Active ${Math.floor(age / DAY_MS)}d ago` };
}
