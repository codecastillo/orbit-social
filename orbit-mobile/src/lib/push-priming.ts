import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPushPermission, isPushSupported } from "@/lib/push";

/**
 * Decides when to show the notifications explainer. The OS prompt is
 * one-shot on iOS, so it is only ever raised after someone has read what
 * push is for and tapped Enable, and the answer is remembered so nobody is
 * asked twice.
 */

const DECISION_KEY = "orbit-push-decision";
const LAUNCH_COUNT_KEY = "orbit-push-launches";

// Ask on the second signed-in launch: enough of the app has been seen for
// "posts from people you follow" to mean something.
const LAUNCHES_BEFORE_PRIMING = 2;

export type PushDecision = "enabled" | "declined" | null;

export async function getPushDecision(): Promise<PushDecision> {
  const raw = await AsyncStorage.getItem(DECISION_KEY);
  return raw === "enabled" || raw === "declined" ? raw : null;
}

export async function setPushDecision(decision: Exclude<PushDecision, null>) {
  await AsyncStorage.setItem(DECISION_KEY, decision);
}

/**
 * Counts this signed-in launch and reports whether the explainer is due.
 * Call once per app start.
 */
export async function recordLaunchAndCheckPriming(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (await getPushDecision()) return false;

  const permission = await getPushPermission();
  // Already answered at the OS level: granted needs no pitch, and a denial
  // can only be undone in the OS settings from the notifications screen.
  if (!permission || permission.status === "granted" || !permission.canAskAgain) {
    return false;
  }

  const raw = await AsyncStorage.getItem(LAUNCH_COUNT_KEY);
  const launches = (Number.parseInt(raw ?? "0", 10) || 0) + 1;
  await AsyncStorage.setItem(LAUNCH_COUNT_KEY, String(launches));

  return launches >= LAUNCHES_BEFORE_PRIMING;
}
