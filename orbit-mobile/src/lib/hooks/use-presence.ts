import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  getHideActivity,
  getVisibleLastSeen,
  getVisibleLastSeenMany,
  presenceOf,
  touchLastSeen,
  HEARTBEAT_MS,
  PRESENCE_REFRESH_MS,
  type Presence,
} from "@/lib/queries/presence";

/** Cache key for the viewer's own hide_activity, invalidated on save. */
export const HIDE_ACTIVITY_KEY = "hide-activity";

const HIDE_ACTIVITY_STALE_MS = 5 * 60 * 1000;

export function useHideActivity() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [HIDE_ACTIVITY_KEY, user?.id],
    queryFn: () => getHideActivity(user!.id),
    enabled: !!user,
    staleTime: HIDE_ACTIVITY_STALE_MS,
  });
}

/**
 * Keeps the signed-in user's last_seen_at fresh. Mount once, at the root
 * layout. Writes only while the app is foregrounded, at most once per
 * HEARTBEAT_MS, and never at all while the user hides their activity status.
 */
export function usePresenceHeartbeat() {
  const { user } = useAuth();
  const { data: hidden } = useHideActivity();
  const lastBeatAt = useRef(0);

  useEffect(() => {
    // Undefined means the setting has not loaded yet; only a confirmed false
    // authorises a write.
    if (!user || hidden !== false) return;

    // The hook stays mounted across an account switch, so the throttle from
    // the previous account would otherwise suppress the new one's first beat.
    lastBeatAt.current = 0;

    const beat = () => {
      if (AppState.currentState !== "active") return;
      if (Date.now() - lastBeatAt.current < HEARTBEAT_MS) return;
      lastBeatAt.current = Date.now();
      void touchLastSeen().catch(() => {});
    };

    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") beat();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [user, hidden]);
}

/** Presence for one person, or null when there is nothing to show. */
export function usePresence(
  targetId: string | null | undefined,
): Presence | null {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["presence", targetId, user?.id],
    queryFn: () => getVisibleLastSeen(targetId!, user!.id),
    enabled: !!targetId && !!user && targetId !== user.id,
    staleTime: PRESENCE_REFRESH_MS,
    refetchInterval: PRESENCE_REFRESH_MS,
  });
  return presenceOf(data);
}

/** Presence for a list of people, keyed by user id. */
export function usePresenceMap(targetIds: string[]) {
  const { user } = useAuth();
  // Sorted and joined so a reordered list doesn't refetch the same people.
  const key = [...targetIds].sort().join(",");
  const { data } = useQuery({
    queryKey: ["presence-many", key, user?.id],
    queryFn: () => getVisibleLastSeenMany(targetIds, user!.id),
    enabled: !!user && targetIds.length > 0,
    staleTime: PRESENCE_REFRESH_MS,
    refetchInterval: PRESENCE_REFRESH_MS,
  });

  return (targetId: string | null | undefined): Presence | null =>
    targetId ? presenceOf(data?.get(targetId)) : null;
}
