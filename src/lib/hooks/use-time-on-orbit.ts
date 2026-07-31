"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Informational time-on-Orbit tracking. Active time accumulates into a
 * per-day localStorage key while the tab is visible; nothing leaves the
 * browser. The optional reminder is one non-blocking toast per day once the
 * chosen minute threshold is crossed. No streaks, no guilt, just a number.
 */

const DAY_PREFIX = "orbit-time-";
const REMINDED_PREFIX = "orbit-time-reminded-";
const THRESHOLD_KEY = "orbit-time-reminder-minutes";
const TICK_MS = 15_000;
const STATS_REFRESH_MS = 30_000;
const AVERAGE_WINDOW_DAYS = 7;

export const REMINDER_OPTIONS = [0, 30, 60, 120] as const;

// Local date, not UTC: "today" should roll over at the user's midnight.
function dayStamp(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function readSeconds(stamp: string): number {
  const raw = localStorage.getItem(DAY_PREFIX + stamp);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getReminderThreshold(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(THRESHOLD_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return (REMINDER_OPTIONS as readonly number[]).includes(parsed) ? parsed : 0;
}

export function setReminderThreshold(minutes: number) {
  localStorage.setItem(THRESHOLD_KEY, String(minutes));
}

function maybeRemind(todaySeconds: number) {
  const threshold = getReminderThreshold();
  if (threshold === 0) return;
  const stamp = dayStamp();
  if (localStorage.getItem(REMINDED_PREFIX + stamp)) return;
  const minutes = Math.floor(todaySeconds / 60);
  if (minutes < threshold) return;
  localStorage.setItem(REMINDED_PREFIX + stamp, "1");
  toast(`You've been on Orbit for ${minutes} minutes today`, {
    duration: 8000,
  });
}

/**
 * Accumulates visible time into today's counter. Mount exactly once (the
 * main layout) so ticks are never double counted.
 */
export function useTimeOnOrbitTracker() {
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const stamp = dayStamp();
      const total = readSeconds(stamp) + TICK_MS / 1000;
      localStorage.setItem(DAY_PREFIX + stamp, String(total));
      maybeRemind(total);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);
}

/** Read-only stats for the settings card, refreshed while the card is open. */
export function useTimeOnOrbitStats() {
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [dailyAverageMinutes, setDailyAverageMinutes] = useState(0);
  const [threshold, setThresholdState] = useState(0);

  useEffect(() => {
    const refresh = () => {
      let weekSeconds = 0;
      for (let i = 0; i < AVERAGE_WINDOW_DAYS; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        weekSeconds += readSeconds(dayStamp(date));
      }
      setTodayMinutes(Math.floor(readSeconds(dayStamp()) / 60));
      setDailyAverageMinutes(Math.round(weekSeconds / AVERAGE_WINDOW_DAYS / 60));
      setThresholdState(getReminderThreshold());
    };
    refresh();
    const interval = setInterval(refresh, STATS_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const setThreshold = (minutes: number) => {
    setReminderThreshold(minutes);
    setThresholdState(minutes);
  };

  return { todayMinutes, dailyAverageMinutes, threshold, setThreshold };
}
