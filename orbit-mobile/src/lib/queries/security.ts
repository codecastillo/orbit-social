import { supabase } from "@/lib/supabase";

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

// Same heuristics as the web activity page so both surfaces label a
// device identically.
export function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";

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
