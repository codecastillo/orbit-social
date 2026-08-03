import { supabase } from "@/lib/supabase";

// Mirrors the web VOD read path (src/lib/queries/vods.ts) against live_vods.
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

export interface VodStreamerProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export interface VodWithProfile extends VodRow {
  profile: VodStreamerProfile | null;
}

// live_vods carries no profile join on the web either (the player fetches
// the streamer separately), so batch the same profiles lookup here.
export async function getRecentVods(limit = 20): Promise<VodWithProfile[]> {
  const { data, error } = await supabase
    .from("live_vods")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const vods = (data ?? []) as VodRow[];
  if (vods.length === 0) return [];

  const userIds = [...new Set(vods.map((v) => v.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);
  if (profilesError) throw profilesError;

  const byId = new Map(
    ((profiles ?? []) as VodStreamerProfile[]).map((p) => [p.id, p]),
  );
  return vods.map((v) => ({ ...v, profile: byId.get(v.user_id) ?? null }));
}

export async function getVodById(vodId: string): Promise<VodWithProfile | null> {
  const { data, error } = await supabase
    .from("live_vods")
    .select("*")
    .eq("id", vodId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const vod = data as VodRow;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", vod.user_id)
    .maybeSingle();
  return { ...vod, profile: (profile as VodStreamerProfile | null) ?? null };
}

export async function incrementVodViews(vodId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_vod_views", {
    p_vod_id: vodId,
  });
  if (error) throw error;
}
