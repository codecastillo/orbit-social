import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getNewestFeedPostAt, type FeedTab } from "@/lib/queries/posts";

// The feed is not a live ticker: one check a minute while the feed is on
// screen, plus one whenever the app comes back to the foreground.
const FRESHNESS_POLL_MS = 60_000;

/**
 * True when the server holds posts newer than the top of the loaded feed.
 * `newestLoadedAt` is the created_at of the first rendered post; passing
 * null (feed still loading or empty) disables the check.
 *
 * Polling is gated on both the screen being focused and the app being
 * foregrounded, so a backgrounded app or a different tab costs nothing.
 */
export function useNewPosts(
  userId: string,
  tab: FeedTab,
  newestLoadedAt: string | null,
): boolean {
  const [screenFocused, setScreenFocused] = useState(false);
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setAppActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);

  const { data: newestServerAt } = useQuery({
    queryKey: ["feed-newest", userId, tab],
    queryFn: () => getNewestFeedPostAt(userId, tab),
    enabled: !!userId && !!newestLoadedAt && screenFocused && appActive,
    refetchInterval: FRESHNESS_POLL_MS,
    // Re-enabling on focus or foreground refetches immediately, which is the
    // "check when the user comes back" half of the contract.
    staleTime: 0,
  });

  if (!newestLoadedAt || !newestServerAt) return false;
  return Date.parse(newestServerAt) > Date.parse(newestLoadedAt);
}
