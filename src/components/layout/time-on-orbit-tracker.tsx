"use client";

import { useTimeOnOrbitTracker } from "@/lib/hooks/use-time-on-orbit";

// Mounted once at the (main) layout level, alongside RealtimeBridge, so time
// accumulates on every signed-in page and the daily reminder toast can fire
// wherever the user happens to be browsing.
export function TimeOnOrbitTracker() {
  useTimeOnOrbitTracker();
  return null;
}
