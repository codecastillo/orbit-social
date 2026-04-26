import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMuxLiveStream } from "@/lib/services/mux";

const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  const { data: existing } = await supabase
    .from("live_streams")
    .select("id, mux_live_stream_id, mux_playback_id, stream_key, status")
    .eq("user_id", user.id)
    .not("mux_live_stream_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.stream_key && existing.mux_playback_id) {
    return NextResponse.json(
      {
        streamId: existing.id,
        rtmpsUrl: "rtmps://global-live.mux.com:443/app",
        srtUrl: `srt://global-live.mux.com:6001?streamid=${existing.stream_key}`,
        streamKey: existing.stream_key,
        playbackId: existing.mux_playback_id,
        status: existing.status,
      },
      { headers: noStore },
    );
  }

  let mux;
  try {
    mux = await createMuxLiveStream();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("Mux create failed", e);
    return NextResponse.json(
      { error: "mux_create_failed", detail },
      { status: 502, headers: noStore },
    );
  }

  const { data, error } = await supabase
    .from("live_streams")
    .insert({
      user_id: user.id,
      title: null,
      status: "idle",
      mux_live_stream_id: mux.muxLiveStreamId,
      mux_playback_id: mux.muxPlaybackId,
      stream_key: mux.streamKey,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("DB insert failed", error);
    return NextResponse.json(
      { error: "db_insert_failed", detail: error?.message ?? null },
      { status: 500, headers: noStore },
    );
  }

  return NextResponse.json(
    {
      streamId: data.id,
      rtmpsUrl: mux.rtmpsUrl,
      srtUrl: mux.srtUrl,
      streamKey: mux.streamKey,
      playbackId: mux.muxPlaybackId,
      status: "idle",
    },
    { headers: noStore },
  );
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : null;
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400, headers: noStore });
  }

  const { error } = await supabase
    .from("live_streams")
    .update({ title })
    .eq("user_id", user.id)
    .not("mux_live_stream_id", "is", null);

  if (error) {
    return NextResponse.json(
      { error: "db_update_failed", detail: error.message },
      { status: 500, headers: noStore },
    );
  }

  return NextResponse.json({ ok: true }, { headers: noStore });
}
