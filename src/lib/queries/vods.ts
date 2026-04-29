import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface VodRow {
  id: string;
  stream_id: string | null;
  user_id: string;
  title: string | null;
  category: string | null;
  mux_asset_id: string;
  mux_playback_id: string;
  duration_seconds: number | null;
  view_count: number;
  thumbnail_url: string | null;
  created_at: string;
}

export async function getUserVods(
  userId: string,
  limit = 20,
): Promise<VodRow[]> {
  const { data, error } = await supabase
    .from("live_vods")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as VodRow[];
}

export async function getVodById(vodId: string): Promise<VodRow | null> {
  const { data, error } = await supabase
    .from("live_vods")
    .select("*")
    .eq("id", vodId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as VodRow | null;
}

export async function incrementVodViews(vodId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_vod_views", {
    p_vod_id: vodId,
  });
  if (error) throw error;
}

export async function deleteVod(vodId: string): Promise<void> {
  const res = await fetch("/api/live/vod/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vodId }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error || `delete_failed_${res.status}`);
  }
}
