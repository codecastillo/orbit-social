import { supabase } from "@/lib/supabase";

export interface LiveStreamWithProfile {
  id: string;
  user_id: string;
  title: string;
  mux_playback_id: string | null;
  status: "idle" | "live" | "ended";
  viewer_count: number;
  started_at: string | null;
  category: string | null;
  tags: string[];
  mature: boolean;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

const STREAM_SELECT = `
  id, user_id, title, mux_playback_id, status, viewer_count, started_at,
  category, tags, mature,
  profiles!live_streams_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  )
`;

export async function getLiveStreams(): Promise<LiveStreamWithProfile[]> {
  const { data, error } = await supabase
    .from("live_streams")
    .select(STREAM_SELECT)
    .eq("status", "live")
    .order("viewer_count", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LiveStreamWithProfile[];
}

export async function getStreamById(
  streamId: string,
): Promise<LiveStreamWithProfile | null> {
  const { data, error } = await supabase
    .from("live_streams")
    .select(STREAM_SELECT)
    .eq("id", streamId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as LiveStreamWithProfile | null;
}

export function hlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}
