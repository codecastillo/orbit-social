"use client";

import { usePresenceHeartbeat } from "@/lib/hooks/use-presence";

// Mounted once at the (main) layout level, alongside RealtimeBridge, so
// last_seen_at stays fresh wherever the user is browsing rather than only
// while the messages tab is open.
export function PresenceHeartbeat() {
  usePresenceHeartbeat();
  return null;
}
