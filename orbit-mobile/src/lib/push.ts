import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";

/**
 * Registers this device for remote push and stores the Expo push token.
 * Inert inside Expo Go (Expo removed remote push there in SDK 53) and when
 * no EAS projectId is configured yet; both activate automatically in a
 * development or production build after `eas init`.
 */
export async function registerForPush(userId: string): Promise<void> {
  if (Constants.appOwnership === "expo") return;
  if (!Device.isDevice) return;

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("[push] no EAS projectId configured, skipping registration");
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return;

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
  if (Constants.appOwnership === "expo") return;
  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from("expo_push_tokens").delete().eq("token", token);
  } catch {
    // Losing the token row on sign-out is best effort; the sender prunes
    // DeviceNotRegistered tokens anyway.
  }
}
