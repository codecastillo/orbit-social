import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { toMobilePath } from "@/lib/deep-links";

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
        // A tap on something the app cannot open still deserves context, so
        // unknown payloads land on the activity feed.
        router.push(toMobilePath(url, "/notifications") as never);
      }
    };

    Notifications.getLastNotificationResponseAsync().then(route);
    const sub = Notifications.addNotificationResponseReceivedListener(route);
    return () => sub.remove();
  }, [router]);
}
