import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";

export type PushEnableResult = "granted" | "denied" | "unsupported";

function easProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId;
}

/**
 * Whether this build can hold a push token at all. Expo Go lost remote push
 * in SDK 53, a simulator never gets a token, and the token request needs an
 * EAS projectId; all three come good in a development or production build
 * after `eas init`.
 */
export function isPushSupported(): boolean {
  return (
    Constants.appOwnership !== "expo" && Device.isDevice && !!easProjectId()
  );
}

/** Current OS-level permission, or null when this build cannot use push. */
export async function getPushPermission(): Promise<Notifications.NotificationPermissionsStatus | null> {
  if (!isPushSupported()) return null;
  return Notifications.getPermissionsAsync();
}

/**
 * Stores this device's Expo push token when permission is already granted.
 * Never prompts: the OS prompt is one-shot on iOS, so it belongs behind the
 * priming explainer in `push-priming.ts`.
 */
export async function registerForPush(userId: string): Promise<void> {
  if (!isPushSupported()) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  await storeToken(userId);
}

/**
 * Asks for permission and registers on a yes. Call only from a surface that
 * has already explained what the notifications are for.
 */
export async function enablePush(userId: string): Promise<PushEnableResult> {
  if (!isPushSupported()) return "unsupported";

  const { status: existing } = await Notifications.getPermissionsAsync();
  const status =
    existing === "granted"
      ? existing
      : (await Notifications.requestPermissionsAsync()).status;
  // A previously denied iOS app gets "denied" straight back with no prompt;
  // the caller sends those users to the OS settings instead.
  if (status !== "granted") return "denied";

  await storeToken(userId);
  return "granted";
}

async function storeToken(userId: string): Promise<void> {
  const projectId = easProjectId();
  if (!projectId) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Orbit",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase.from("expo_push_tokens").upsert(
    {
      user_id: userId,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) console.warn("[push] token upsert failed:", error.message);
}

export async function unregisterPush(): Promise<void> {
  const projectId = easProjectId();
  if (Constants.appOwnership === "expo" || !projectId) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from("expo_push_tokens").delete().eq("token", token);
  } catch {
    // Losing the token row on sign-out is best effort; the sender prunes
    // DeviceNotRegistered tokens anyway.
  }
}
