"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { getNewestFeedPostAt } from "@/lib/queries/posts";

// The feed is not a live ticker: one check a minute, plus one whenever the
// tab regains focus, is enough for the pill to feel prompt. React Query
// pauses the interval while the tab is hidden, so a backgrounded tab costs
// nothing.
const FRESHNESS_POLL_MS = 60_000;

/**
 * True when the server holds posts newer than the top of the loaded feed.
 * `newestLoadedAt` is the created_at of the first rendered post; passing
 * null (feed still loading or empty) disables the check entirely.
 */
export function useNewPosts(
  tab: "foryou" | "following",
  newestLoadedAt: string | null
): boolean {
  const { user } = useAuth();

  const { data: newestServerAt } = useQuery({
    queryKey: ["feed-newest", user ? tab : "public", user?.id ?? "anon"],
    queryFn: () => getNewestFeedPostAt(user?.id ?? null, tab),
    enabled: !!newestLoadedAt,
    refetchInterval: FRESHNESS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (!newestLoadedAt || !newestServerAt) return false;
  return Date.parse(newestServerAt) > Date.parse(newestLoadedAt);
}
