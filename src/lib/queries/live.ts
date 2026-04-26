import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface LiveStreamWithProfile {
  id: string;
  user_id: string;
  title: string;
  stream_key: string | null;
  mux_live_stream_id: string | null;
  mux_playback_id: string | null;
  status: "idle" | "live" | "ended";
  viewer_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  total_likes: number;
  category: string | null;
  tags: string[];
  language: string;
  slow_mode_seconds: number;
  followers_only_chat: boolean;
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
  *,
  profiles!live_streams_user_id_fkey (
    id, username, display_name, avatar_url, is_verified
  )
`;

export async function getLiveStreams() {
  const { data, error } = await supabase
    .from("live_streams")
    .select(STREAM_SELECT)
    .eq("status", "live")
    .order("viewer_count", { ascending: false });

  if (error) throw error;
  return data as unknown as LiveStreamWithProfile[];
}

export async function getStreamById(streamId: string) {
  const { data, error } = await supabase
    .from("live_streams")
    .select(STREAM_SELECT)
    .eq("id", streamId)
    .single();

  if (error) throw error;
  return data as unknown as LiveStreamWithProfile;
}


export async function updateStreamStatus(
  streamId: string,
  status: "idle" | "live" | "ended"
) {
  const updates: Record<string, unknown> = { status };

  if (status === "live") {
    updates.started_at = new Date().toISOString();
  } else if (status === "ended") {
    updates.ended_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("live_streams")
    .update(updates)
    .eq("id", streamId)
    .select(STREAM_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as LiveStreamWithProfile;
}
