import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";

/**
 * Routes notification taps to the right screen. The payload's `url` field is
 * set by the server sender (same paths as the web app). Cold-start taps sit
 * in getLastNotificationResponseAsync for the process lifetime, so responses
 * are deduped by request identifier (a mello production fix).
 */
export function useNotificationTaps() {
  const router = useRouter();
  const handled = useRef<Set<string>>(new Set());

  useEffect(() => {
    const route = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled.current.has(id)) return;
      handled.current.add(id);

      const url = response.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        router.push(toMobilePath(url) as never);
      }
    };

    Notifications.getLastNotificationResponseAsync().then(route);
    const sub = Notifications.addNotificationResponseReceivedListener(route);
    return () => sub.remove();
  }, [router]);
}

// Web paths and mobile routes mostly line up; map the ones that differ.
function toMobilePath(webPath: string): string {
  if (webPath.startsWith("/messages/")) {
    return webPath.replace("/messages/", "/conversation/");
  }
  // Explicit so the profile fallback below never claims /messages.
  if (webPath === "/messages") return "/(tabs)/messages";
  if (webPath === "/notifications") return "/notifications";
  if (webPath === "/notifications/requests") return "/follow-requests";
  if (webPath.startsWith("/post/") || webPath.startsWith("/clips/")) return webPath;
  if (webPath.startsWith("/events/") || webPath.startsWith("/communities/")) {
    return webPath;
  }
  // Profile links arrive as /<username>.
  if (/^\/[^/]+$/.test(webPath)) return `/user${webPath}`;
  return "/notifications";
}
