import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapMuxWebhook } from "@/lib/services/mux";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("mux-signature");
  const event = await unwrapMuxWebhook(rawBody, sig);
  if (!event) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const muxLiveStreamId = (event.data as { id?: string } | undefined)?.id;
  if (!muxLiveStreamId) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  switch (event.type) {
    case "video.live_stream.active":
      updates.status = "live";
      updates.started_at = new Date().toISOString();
      break;
    case "video.live_stream.idle":
    case "video.live_stream.disconnected":
      updates.status = "ended";
      updates.ended_at = new Date().toISOString();
      break;
    default:
      return NextResponse.json({ ok: true, ignored: event.type });
  }

  const { error } = await supabase
    .from("live_streams")
    .update(updates)
    .eq("mux_live_stream_id", muxLiveStreamId);

  if (error) {
    console.error("DB update from Mux webhook failed", error);
    return NextResponse.json({ error: "db_update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, type: event.type });
}
