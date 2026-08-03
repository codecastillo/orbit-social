import { Platform } from "react-native";
import * as Device from "expo-device";
import { supabase } from "@/lib/supabase";

const IP_LOOKUP_URL = "https://api.ipify.org?format=json";
const IP_LOOKUP_TIMEOUT_MS = 3000;

export interface LoginEvent {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  flagged: boolean;
  created_at: string;
}

// RLS lets users read only their own login events, same as the web
// activity page.
export async function getLoginEvents(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from("login_events")
    .select("id, ip_address, user_agent, status, flagged, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as LoginEvent[];
}

// Stands in for the browser user agent web writes. Web parses a UA string
// into "browser · OS"; there is no browser here, so send a descriptor that
// already reads as one, e.g. "Orbit iOS 18.5 (iPhone 15 Pro)".
function deviceDescriptor(): string {
  const os = Device.osName ?? Platform.OS;
  const version = Device.osVersion ?? String(Platform.Version);
  const model = Device.modelName;
  return model
    ? `Orbit ${os} ${version} (${model})`
    : `Orbit ${os} ${version}`;
}

/**
 * Records a sign-in in the security audit trail read by the sessions screen
 * and by the web activity page.
 *
 * Only successful sign-ins are recorded, same as web: a failed password
 * attempt leaves no session, and the insert policy on login_events requires
 * auth.uid() = user_id. Failed attempts are visible in the Supabase auth logs
 * instead. IP is best effort from a public lookup because the client has no
 * server hop that could supply it (web does the same).
 */
export async function createLoginEvent(userId: string) {
  let ipAddress: string | null = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IP_LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(IP_LOOKUP_URL, { signal: controller.signal });
    const json = (await res.json()) as { ip?: string };
    ipAddress = json.ip ?? null;
  } catch {
    // Offline, blocked, or timed out: the event is still worth recording.
  } finally {
    clearTimeout(timeout);
  }

  const { error } = await supabase.from("login_events").insert({
    user_id: userId,
    ip_address: ipAddress,
    user_agent: deviceDescriptor(),
    status: "success",
  });

  if (error) throw error;
}

// Same heuristics as the web activity page so both surfaces label a
// device identically.
export function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  // Rows this app writes already carry a readable descriptor.
  if (ua.startsWith("Orbit ")) return ua;

  let browser = "Unknown";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
  else if (ua.includes("Opera/") || ua.includes("OPR/")) browser = "Opera";

  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} · ${os}`;
}
