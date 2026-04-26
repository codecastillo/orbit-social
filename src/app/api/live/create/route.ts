import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMuxLiveStream } from "@/lib/services/mux";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  let mux;
  try {
    mux = await createMuxLiveStream();
  } catch (e) {
    console.error("Mux create failed", e);
    return NextResponse.json({ error: "mux_create_failed" }, { status: 502 });
  }

  const { data, error } = await supabase
    .from("live_streams")
    .insert({
      user_id: user.id,
      title,
      status: "idle",
      mux_live_stream_id: mux.muxLiveStreamId,
      mux_playback_id: mux.muxPlaybackId,
      stream_key: mux.streamKey,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("DB insert failed", error);
    return NextResponse.json({ error: "db_insert_failed" }, { status: 500 });
  }

  return NextResponse.json({
    streamId: data.id,
    rtmpsUrl: mux.rtmpsUrl,
    srtUrl: mux.srtUrl,
    streamKey: mux.streamKey,
    playbackId: mux.muxPlaybackId,
  });
}
