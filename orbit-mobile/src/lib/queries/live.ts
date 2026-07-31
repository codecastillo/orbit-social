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

export interface StreamCredentials {
  streamId: string;
  status: "idle" | "live" | "ended";
  rtmpsUrl: string;
  srtUrl: string;
  streamKey: string;
}

// Mirrors the read path of the web /api/live/me route: RLS lets owners
// select their own row, and the ingest URLs derive from the stream key.
// Provisioning a brand-new stream needs the Mux server call behind that
// route, so a user with no row must set up once on the web first.
export async function getMyStreamCredentials(
  userId: string,
): Promise<StreamCredentials | null> {
  const { data, error } = await supabase
    .from("live_streams")
    .select("id, status, stream_key, mux_playback_id")
    .eq("user_id", userId)
    .not("mux_live_stream_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.stream_key || !data.mux_playback_id) return null;
  return {
    streamId: data.id as string,
    status: data.status as StreamCredentials["status"],
    rtmpsUrl: "rtmps://global-live.mux.com:443/app",
    srtUrl: `srt://global-live.mux.com:6001?streamid=${data.stream_key}`,
    streamKey: data.stream_key as string,
  };
}
