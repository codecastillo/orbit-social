import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Informational time-on-Orbit tracking, the mobile mirror of the web hook in
 * src/lib/hooks/use-time-on-orbit.ts. Foreground time accumulates into a
 * per-day AsyncStorage key; nothing leaves the device. The optional reminder
 * is one gentle banner per day once the chosen minute threshold is crossed.
 */

const DAY_PREFIX = "orbit-time-";
const REMINDED_PREFIX = "orbit-time-reminded-";
const THRESHOLD_KEY = "orbit-time-reminder-minutes";
const FLUSH_MS = 30_000;
const AVERAGE_WINDOW_DAYS = 7;

export const REMINDER_OPTIONS = [0, 30, 60, 120] as const;

// Local date, not UTC: "today" should roll over at the user's midnight.
function dayStamp(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

async function readSeconds(stamp: string): Promise<number> {
  const raw = await AsyncStorage.getItem(DAY_PREFIX + stamp);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getReminderThreshold(): Promise<number> {
  const raw = await AsyncStorage.getItem(THRESHOLD_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return (REMINDER_OPTIONS as readonly number[]).includes(parsed) ? parsed : 0;
}

export async function setReminderThreshold(minutes: number) {
  await AsyncStorage.setItem(THRESHOLD_KEY, String(minutes));
}

/**
 * Accumulates foreground time and surfaces the once-a-day reminder. Mount
 * exactly once (the root layout) so elapsed time is never double counted.
 * Returns the reminder text to render, or null when nothing is due.
 */
export function useTimeOnOrbitTracker() {
  const [reminder, setReminder] = useState<string | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (AppState.currentState === "active") {
      sessionStartRef.current = Date.now();
    }

    const flush = async () => {
      const start = sessionStartRef.current;
      if (start === null) return;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      if (elapsed <= 0) return;
      sessionStartRef.current = Date.now();
      const stamp = dayStamp();
      const total = (await readSeconds(stamp)) + elapsed;
      await AsyncStorage.setItem(DAY_PREFIX + stamp, String(total));

      const threshold = await getReminderThreshold();
      if (threshold === 0) return;
      if (await AsyncStorage.getItem(REMINDED_PREFIX + stamp)) return;
      const minutes = Math.floor(total / 60);
      if (minutes < threshold) return;
      await AsyncStorage.setItem(REMINDED_PREFIX + stamp, "1");
      if (!cancelled) {
        setReminder(`You've been on Orbit for ${minutes} minutes today`);
      }
    };

    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        sessionStartRef.current = Date.now();
      } else {
        // Flush before the JS thread sleeps; timers stall in the background.
        flush();
        sessionStartRef.current = null;
      }
    });
    const interval = setInterval(flush, FLUSH_MS);

    return () => {
      cancelled = true;
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  const dismissReminder = useCallback(() => setReminder(null), []);

  return { reminder, dismissReminder };
}

/** Read-only stats for the settings card, refreshed while the card is open. */
export function useTimeOnOrbitStats() {
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [dailyAverageMinutes, setDailyAverageMinutes] = useState(0);
  const [threshold, setThresholdState] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const stamps: string[] = [];
      for (let i = 0; i < AVERAGE_WINDOW_DAYS; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        stamps.push(dayStamp(date));
      }
      const [daySeconds, savedThreshold] = await Promise.all([
        Promise.all(stamps.map(readSeconds)),
        getReminderThreshold(),
      ]);
      if (cancelled) return;
      const weekSeconds = daySeconds.reduce((sum, s) => sum + s, 0);
      setTodayMinutes(Math.floor(daySeconds[0] / 60));
      setDailyAverageMinutes(Math.round(weekSeconds / AVERAGE_WINDOW_DAYS / 60));
      setThresholdState(savedThreshold);
    };
    refresh();
    const interval = setInterval(refresh, FLUSH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const setThreshold = (minutes: number) => {
    setThresholdState(minutes);
    setReminderThreshold(minutes);
  };

  return { todayMinutes, dailyAverageMinutes, threshold, setThreshold };
}
