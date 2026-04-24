import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface LoginEvent {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  flagged: boolean;
  created_at: string;
}

export async function getLoginHistory(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from("login_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as LoginEvent[];
}

export async function createLoginEvent(
  userId: string,
  status: "success" | "failed" = "success"
) {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;

  // Attempt to get IP from a public API (best effort)
  let ipAddress: string | null = null;
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(3000),
    });
    const json = await res.json();
    ipAddress = json.ip ?? null;
  } catch {
    // IP fetch failed, leave as null
  }

  const { error } = await supabase.from("login_events").insert({
    user_id: userId,
    ip_address: ipAddress,
    user_agent: userAgent,
    status,
  });

  if (error) throw error;
}

export async function flagLoginEvent(eventId: string, flagged: boolean) {
  const { error } = await supabase
    .from("login_events")
    .update({ flagged })
    .eq("id", eventId);

  if (error) throw error;
}

export function parseUserAgent(ua: string | null): {
  browser: string;
  os: string;
} {
  if (!ua) return { browser: "Unknown", os: "Unknown" };

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

  return { browser, os };
}
