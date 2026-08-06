import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "orbit-feed-tab";

export type FeedTabPreference = "foryou" | "following";

/**
 * Remembers which feed someone chose.
 *
 * Promise 1 on /promises says "When you pick Following, the choice sticks",
 * and until now it did not: both clients held the tab in plain component
 * state, so every relaunch, and on web every navigation, put the reader back
 * on For you. That is the promise most likely to be noticed when broken,
 * because the people who pick Following pick it deliberately.
 *
 * Stored locally rather than on the profile: it is a per-device reading
 * preference, and a round trip to fetch it would leave the tabs flickering
 * on every launch.
 */
export async function loadFeedTab(): Promise<FeedTabPreference | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored === "following" || stored === "foryou" ? stored : null;
  } catch {
    // An unreadable preference is not worth an error; the default applies.
    return null;
  }
}

export async function saveFeedTab(tab: FeedTabPreference): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, tab);
  } catch {
    // Failing to remember the choice is a small loss, and surfacing it
    // mid-tap would be a larger one.
  }
}
