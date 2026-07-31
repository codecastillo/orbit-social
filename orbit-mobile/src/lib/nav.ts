import type { Router } from "expo-router";

/**
 * Back that cannot dead-end. A screen opened from a deep link or push
 * notification has no history, and router.back() would throw; land on the
 * tabs instead.
 */
export function safeBack(router: Router) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)");
  }
}
