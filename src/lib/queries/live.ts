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

export interface CreatedStreamIngest {
  streamId: string;
  rtmpsUrl: string;
  srtUrl: string;
  streamKey: string;
  playbackId: string;
}

export async function createStream(_userId: string, title: string): Promise<CreatedStreamIngest> {
  const res = await fetch("/api/live/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? `create_stream_failed_${res.status}`);
  }
  return (await res.json()) as CreatedStreamIngest;
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
